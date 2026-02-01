require("dotenv").config();

const mongoose = require("mongoose");
const express = require("express");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const { v1: uuidv1 } = require("uuid");const cookieParser = require("cookie-parser");
const { notStrictEqual } = require("assert");
const app = express();
const PORT = process.env.PORT || 3000;

const mongoURI = process.env.MONGO_URI;


mongoose
  .connect(mongoURI)
  .then(() => console.log(`Connected to MongoDB at ${mongoURI}`))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

app.use(express.json());
app.use(cookieParser());

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true }, // Added email field
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);


app.post("/signup", async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  if (!req.body) {
    return res.status(400).json({ message: "Bad Request" });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Password do not match" });
  }
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
  if (existingUser) {
    return res
      .status(400)
      .json({ message: "User with this email or username already exists" });
  }

  const user = new User({
    userId: uuidv1(),
    username,
    email,
    password,
  });
  await user.save();
  res.redirect("/login");
});

app.post("/login", async (req, res, next) => {
  const { email, password } = req.body;
  if (!req.body) {
    return res.status(400).json({ message: "Bad Request" });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }
  // Ensure you have a JWT_SECRET in your .env file
  const token = jwt.sign(
    { id: user._id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Use secure cookies in production
  });

  res.status(200).json({ message: "User logged in" });
});

app.post("/passwordReset", async (req, res, next) => {
  const { email, username } = req.body;

  if (!req.body) {
    return res.status(400).json({ message: "Bad Request" });
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }
  res.status(200).json({ message: "Check your email for reset link" });
  const token = crypto.randomBytes(20).toString("hex");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.user,
      pass: process.env.pass,
    },
  });
  const mailOptions = {
    type: "OAuth2",
    from: process.env.user,
    to: email,
    subject: "Password Reset",
    text: `Click the following link to reset your password: http://localhost:3000/reset-password/${token}`,
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send("Error sending email");
    } else {
      console.log(`Email sent: ${info.response}`);
      res
        .status(200)
        .send("Check your email for instructions on resetting your password");
    }
  });
});

app.get("/passwordReset/:token", async (req, res, next) => {
  const { token } = req.params;

  if (users.some((user) => user.resetToken === token)) {
    res.send(
      '<form method="post" action="/reset-password"><input type="password" name="password" required><input type="submit" value="Reset Password"></form>'
    );
  } else {
    res.status(404).send("Invalid or expired token");
  }
});

app.get("/passwordReset", async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  const user = users.find((user) => user.resetToken === token);
  if (user) {
    user.password = password;
    delete user.resetToken; // Remove the reset token after the password is updated
    res.status(200).send("Password updated successfully");
  } else {
    res.status(404).send("Invalid or expired token");
  }
});


app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});


app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
