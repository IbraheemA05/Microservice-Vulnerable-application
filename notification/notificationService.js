require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const cors = require("cors");
const axios = require("axios");
const handlebars = require("handlebars");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost', 'http://localhost:80', 'http://frontend'],
  credentials: true
}));

// --- Database Connection ---
const mongoURI = process.env.MONGO_URI;

mongoose
  .connect(mongoURI)
  .then(() => console.log(`Notification Service Connected to MongoDB at ${mongoURI}`))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// --- Notification Schema ---
const notificationSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  type: { type: String, enum: ['email', 'sms', 'push', 'webhook'], required: true },
  recipient: { type: String, required: true },
  subject: { type: String },
  message: { type: String, required: true },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  sentAt: { type: Date },
  error: { type: String },
}, { timestamps: true });

const Notification = mongoose.model("Notification", notificationSchema);

// --- Email Template Schema (for template injection vulnerability) ---
const templateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  createdBy: { type: String, required: true },
}, { timestamps: true });

const Template = mongoose.model("Template", templateSchema);

// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Email Transporter Setup ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.user,
    pass: process.env.pass,
  },
});


app.get("/me", authenticateToken, (req, res) => {
  res.json({
    username: req.user.username,
    id: req.user.id
  });
});

// VULNERABILITY: Server-Side Request Forgery (SSRF)
// This endpoint makes HTTP requests to user-supplied URLs without validation
app.post("/webhook/trigger", authenticateToken,  async (req, res) => {
  try {
    const { url, method = "POST", data, headers = {} } = req.body;

    if (!url) {
      return res.status(400).json({ message: "URL is required" });
    }

    console.log(`[WEBHOOK] User ${req.user.username} triggering webhook to: ${url}`);

    // VULNERABILITY: No URL validation - can access internal services, cloud metadata, etc.
    const response = await axios({
      method: method,
      url: url, // User-controlled URL - SSRF vulnerability!
      data: data,
      headers: headers,
      timeout: 5000,
      maxRedirects: 5
    });

    res.status(200).json({
      message: "Webhook triggered successfully",
      status: response.status,
      data: response.data,
      headers: response.headers
    });
  } catch (error) {
    console.error("Webhook error:", error.message);
    // VULNERABILITY: Verbose error messages leak internal network info
    res.status(500).json({
      message: "Webhook failed",
      error: error.message,
      code: error.code,
      response: error.response?.data
    });
  }
});

// VULNERABILITY: Template Injection
// Users can create templates with Handlebars that execute arbitrary code
app.post("/template/create", authenticateToken, async (req, res) => {
  try {
    const { name, subject, body } = req.body;

    if (!name || !subject || !body) {
      return res.status(400).json({ message: "Name, subject, and body are required" });
    }

    // VULNERABILITY: No sanitization of template body - allows code injection
    const template = new Template({
      name,
      subject,
      body, // User-controlled template with Handlebars syntax
      createdBy: req.user.username
    });

    await template.save();

    res.status(201).json({
      message: "Template created successfully",
      template: { name, subject, body }
    });
  } catch (error) {
    console.error("Template creation error:", error);
    if (error.code === 11000) {
      return res.status(400).json({ message: "Template name already exists" });
    }
    res.status(500).json({ message: "Server error" });
  }
});

// VULNERABILITY: Template Injection Execution
// Renders user-created templates with Handlebars (allows code execution)
app.post("/template/send", authenticateToken, async (req, res) => {
  try {
    const { templateName, recipient, data = {} } = req.body;

    if (!templateName || !recipient) {
      return res.status(400).json({ message: "Template name and recipient required" });
    }

    const template = await Template.findOne({ name: templateName });
    if (!template) {
      return res.status(404).json({ message: "Template not found" });
    }

    // VULNERABILITY: Compiles and executes user-controlled template
    // Handlebars can execute JavaScript code through helpers and expressions
    const compiledSubject = handlebars.compile(template.subject);
    const compiledBody = handlebars.compile(template.body);

    const renderedSubject = compiledSubject(data);
    const renderedBody = compiledBody(data);

    console.log(`[TEMPLATE] Rendering template '${templateName}' for ${recipient}`);

    // Send email with rendered template
    if (process.env.user && process.env.pass) {
      await transporter.sendMail({
        from: process.env.user,
        to: recipient,
        subject: renderedSubject,
        html: renderedBody
      });
    }

    // Log notification
    const notification = new Notification({
      userId: req.user.id,
      type: 'email',
      recipient,
      subject: renderedSubject,
      message: renderedBody,
      status: 'sent',
      sentAt: new Date()
    });
    await notification.save();

    res.status(200).json({
      message: "Template email sent successfully",
      subject: renderedSubject,
      preview: renderedBody.substring(0, 100) + "..."
    });
  } catch (error) {
    console.error("Template send error:", error);
    res.status(500).json({ message: "Error sending template email", error: error.message });
  }
});

// VULNERABILITY: Insecure Direct Object Reference (IDOR) + Information Disclosure
// Fetch notification history without proper authorization checks
app.get("/notifications/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // VULNERABILITY: No check if req.user.id matches userId
    // Any authenticated user can view any other user's notifications
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      message: "Notifications retrieved",
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Standard email sending endpoint
app.post("/send/email", authenticateToken, async (req, res) => {
  try {
    const { email, subject, text, html } = req.body;

    if (!email || !subject || (!text && !html)) {
      return res.status(400).json({ message: "Email, subject, and message are required" });
    }

    // VULNERABILITY: No email validation - can send to any address
    // No rate limiting - can be used for spam
    const info = await transporter.sendMail({
      from: `Notification Service <${process.env.user}>`,
      to: email,
      subject,
      text,
      html
    });

    const notification = new Notification({
      userId: req.user.id,
      type: 'email',
      recipient: email,
      subject,
      message: text || html,
      status: 'sent',
      sentAt: new Date()
    });
    await notification.save();

    res.status(200).json({
      message: "Email sent successfully",
      messageId: info.messageId
    });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ message: "Error sending email" });
  }
});

// VULNERABILITY: XML External Entity (XXE) Injection
// Accepts XML payloads for SMS notifications
app.post("/send/sms/xml", authenticateToken, async (req, res) => {
  try {
    const xml = req.body.xml;

    if (!xml) {
      return res.status(400).json({ message: "XML payload required" });
    }

    // VULNERABILITY: Parses XML without disabling external entities
    // In a real implementation, this would use an XML parser like libxmljs
    // For demonstration, we'll just acknowledge the vulnerability
    console.log("[XXE VULNERABILITY] Parsing XML without entity restrictions:");
    console.log(xml);

    res.status(200).json({
      message: "XML SMS payload received (not implemented - vulnerable to XXE)",
      warning: "This endpoint is vulnerable to XXE injection attacks"
    });
  } catch (error) {
    console.error("XML SMS error:", error);
    res.status(500).json({ message: "Error processing XML" });
  }
});

// VULNERABILITY: Insecure Deserialization
// Accepts serialized notification objects
app.post("/send/batch", authenticateToken, async (req, res) => {
  try {
    const { serializedData } = req.body;

    if (!serializedData) {
      return res.status(400).json({ message: "Serialized data required" });
    }

    // VULNERABILITY: Deserializes user input without validation
    // Could lead to RCE if using unsafe deserialization libraries
    const notifications = JSON.parse(serializedData);

    console.log(`[DESERIALIZATION] Processing ${notifications.length} notifications`);

    res.status(200).json({
      message: "Batch notifications queued (vulnerable to insecure deserialization)",
      count: notifications.length
    });
  } catch (error) {
    console.error("Batch send error:", error);
    res.status(500).json({ message: "Error processing batch" });
  }
});

// Get all templates (for reference)
app.get("/templates", authenticateToken, async (req, res) => {
  try {
    const templates = await Template.find().select('-__v');
    res.status(200).json({ templates });
  } catch (error) {
    console.error("Templates fetch error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Notification service is running on port http://localhost:${PORT}`);
});
