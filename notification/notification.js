const nodemailer = require("nodemailer");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());

function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (token == null) return res.sendStatus(401); // if no token, unauthorized

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // if token is invalid, forbidden
    req.user = user;
    next();
  });
}
const transporter = nodemailer.createTransport({
    service: "gmail",
    type: "OAuth2",
    auth: {
        user: process.env.user,
        pass: process.env.pass,
    },
})
app.post ("/send/email", authenticateToken, async (req, res) => {
    const {email, subject, text} = req.body;
    
    if (!email || !subject || !text) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  try {
    const info = await transporter.sendMail({
      from: "Notification Service <" + process.env.user + ">",
      to: email,
      subject,
      text
    });
    res.status(200).json({ success: true, message: "Email sent", info });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error sending email" });
  }
})

app.post("/send/sms", authenticateToken, async (req, res) => {
    const {phone, message} = req.body;
x})

app.post("/send/push", authenticateToken, async (req, res) => {
    const {deviceToken, title, body} = req.body;
})


app.get("/notification", authenticateToken, (req, res) => {
    
})

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log(`Notification service is running on port http://localhost:${PORT}`);
})