require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const defaultSettings = require("./defaultSettings.js");
const cors = require("cors");
const app = express();
// Use a different port for the setting service
const PORT = process.env.PORT || 4000;

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
  .then(() =>
    console.log(`Setting Service Connected to MongoDB at ${mongoURI}`)
  )
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// --- User Schema and Model (should be consistent with auth service) ---
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { versionKey: false, timestamps: true });

const User = mongoose.model("User", userSchema);


//--- Setting Model for the /reset--router
const settingsSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    preferences: {
      theme: { type: String, default: "light" },
      language: { type: String, default: "en" },
      timezone: { type: String, default: "UTC" },
    },
    notifications: {
      email: { type: Boolean, default: true },
    },
    privacy: {
      profileVisible: { type: Boolean, default: true },
      searchIndexing: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model("Settings", settingsSchema);


// --- Authentication Middleware ---
function authenticateToken(req, res, next) {
  const token = req.cookies.token;

  if (token == null) return res.sendStatus(401); // if no token, unauthorized

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403); // if token is invalid, forbidden
    req.user = user;
    next();
  });
}

// --- Protected Route ---
app.get("/me", authenticateToken, async (req, res) => {
  try {
    // The user's ID is available in req.user.id from the JWT payload
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/user/change-name", authenticateToken, async (req, res) => {
  const { username } = req.body;
  const userId = req.user.id;

  if (!username) {
    return res.status(400).json({ message: "Username is required" });
  }

  try {
    // Find the user and update their username
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { username: username },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    if (updatedUser.username === username) {
      return res.status(400).json({
        message: "Username already set", user: {
          id: updatedUser._id,
          username: updatedUser.username
        }
      });
    }

    res.json({
      message: "Username updated successfully", user: {
        id: updatedUser._id,
        username: updatedUser.username
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/user/change-password", authenticateToken, async (req, res) => {
  const { password, confirmPassword } = req.body;
  const userId = req.user.id;

  if (!password || !confirmPassword) {
    return res.status(400).json({ message: "Password fields required" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { password: password },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
})

app.post("/settings/reset", authenticateToken, async (req, res) => {
  try {
    const userId = req.body;

    const settings = await Settings.findOneAndUpdate(
      { userId },
      { $set: defaultSettings },
      {
        new: true,
        upsert: true, // create if missing
        runValidators: true,
      }
    );

    // 🔍 AUDIT LOG (important for security labs)
    console.log(`[AUDIT] Settings reset`, {
      userId,
      action: "RESET_SETTINGS",
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      message: "Settings reset to default",
      settings,
    });
  } catch (err) {
    console.error("Reset settings error:", err);
    res.status(500).json({ message: "Internal server error" });
  }

});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Setting service is running on port http://localhost:${PORT}`);
});
