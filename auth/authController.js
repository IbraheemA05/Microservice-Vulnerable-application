require("dotenv").config();

const cors = require("cors");
const mongoose = require("mongoose");
const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const { v1: uuidv1 } = require("uuid"); const cookieParser = require("cookie-parser");
const { notStrictEqual } = require("assert");
const { error } = require("console");
const app = express();
const PORT = process.env.PORT || 3000;
const mongoURI = process.env.MONGO_URI;


mongoose
  .connect(mongoURI)
  .then(() => console.log(`Connected to MongoDB at ${mongoURI}`))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost', 'http://localhost:8080', 'http://frontend', 'http://localhost:5500'],
  credentials: true
}));


const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
}, { versionKey: false, timestamps: true }); // Disable __v and enable timestamps

const User = mongoose.model("User", userSchema);


app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!req.body || !username || !email || !password) {
      return res.status(400).json({ message: "Bad Request - Missing required fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const user = new User({
      userId: uuidv1(),
      username,
      email,
      password, // Note: In production, hash this with bcrypt!
    });

    await user.save(); // Save FIRST, then respond

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Server error during signup" });
  }
});

app.post("/login", async (req, res, next) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Bad Request" });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Validate password
    // Note: In production, use bcrypt.compare(password, user.password)
    if (user.password !== password) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({ message: "User logged in", username: user.username });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error during login" });
  }
});

// VULNERABILITY: Request password reset token via email
app.post("/password-reset/request", async (req, res, next) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Bad Request" });
    }
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists (security best practice, but we'll still leak it elsewhere)
      return res.status(200).json({ message: "If that email exists, a reset link has been sent" });
    }
    
    // Generate reset token
    const token = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
    
    // Store token in database
    user.resetToken = token;
    user.resetTokenExpiry = tokenExpiry;
    await user.save();
    
    console.log(`[DEBUG] Reset token generated for ${email}: ${token}`);
    
    // Send email (if configured)
    if (process.env.user && process.env.pass) {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.user,
          pass: process.env.pass,
        },
      });
      const mailOptions = {
        from: process.env.user,
        to: email,
        subject: "Password Reset Request",
        text: `Click the following link to reset your password: http://localhost:8080/reset-password.html?token=${token}\n\nThis link will expire in 1 hour.`,
        html: `<p>Click the following link to reset your password:</p><p><a href="http://localhost:8080/reset-password.html?token=${token}">Reset Password</a></p><p>This link will expire in 1 hour.</p>`,
      };
      
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("Email send error:", error);
        } else {
          console.log(`Email sent: ${info.response}`);
        }
      });
    }
    
    res.status(200).json({ message: "If that email exists, a reset link has been sent" });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// VULNERABILITY: Weak isolation on dual-use endpoint
// This endpoint handles BOTH authenticated users (via JWT) AND unauthenticated users (via reset token)
// Creating potential for privilege escalation and authentication bypass
app.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword, email } = req.body;
    const jwtToken = req.cookies.token;
    
    if (!password || !confirmPassword) {
      return res.status(400).json({ message: "Password and confirmation required" });
    }
    
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }
    
    let user;
    
    // VULNERABILITY: Weak isolation - endpoint accepts EITHER JWT token OR reset token
    // An attacker could potentially exploit the dual authentication paths
    if (jwtToken) {
      // Path 1: Authenticated user changing password (like settings service)
      try {
        const decoded = jwt.verify(jwtToken, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
        console.log(`[AUDIT] Password reset via JWT for user: ${user?.username}`);
      } catch (err) {
        // JWT invalid, fall through to token-based reset
      }
    }
    
    // Path 2: Unauthenticated user with reset token
    if (!user && token) {
      user = await User.findOne({ 
        resetToken: token,
        resetTokenExpiry: { $gt: new Date() }
      });
      
      if (user) {
        console.log(`[AUDIT] Password reset via reset token for user: ${user.username}`);
      }
    }
    
    // VULNERABILITY: If email is provided, allow password reset without proper verification
    // This creates a third authentication path with even weaker controls
    if (!user && email) {
      user = await User.findOne({ email });
      if (user) {
        console.log(`[AUDIT] Password reset via email parameter for user: ${user.username}`);
      }
    }
    
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }
    
    // Update password (plaintext, intentionally vulnerable)
    user.password = password;
    
    // Clear reset token
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    
    await user.save();
    
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.delete("/health", (req, res) => {
  res.status(404).json({ status: "Your Papa Wanka" });
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
