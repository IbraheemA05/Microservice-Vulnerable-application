require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
const PORT = process.env.PORT || 6000;

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
  .then(() => console.log(`Upload Service Connected to MongoDB at ${mongoURI}`))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// --- File Schema ---
const fileSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  originalName: { type: String, required: true },
  filename: { type: String, required: true },
  mimetype: { type: String },
  size: { type: Number },
  path: { type: String, required: true },
  isPublic: { type: Boolean, default: false },
  downloadCount: { type: Number, default: 0 },
}, { timestamps: true });

const File = mongoose.model("File", fileSchema);

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

// VULNERABILITY: Unrestricted File Upload
// No file type validation, size limits, or content validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // VULNERABILITY: Uses original filename without sanitization
    // Allows path traversal characters like ../, special characters, etc.
    const filename = file.originalname;
    console.log(`[UPLOAD] Saving file as: ${filename}`);
    cb(null, filename);
  }
});

// VULNERABILITY: No file size limit, no file type restrictions
const upload = multer({ 
  storage: storage,
  // Intentionally missing: limits, fileFilter
});

// VULNERABILITY: Unrestricted file upload endpoint
app.post("/upload", authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // VULNERABILITY: Stores file metadata without validation
    const fileRecord = new File({
      userId: req.user.id,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      isPublic: req.body.isPublic === 'true'
    });

    await fileRecord.save();

    console.log(`[UPLOAD] File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

    res.status(201).json({
      message: "File uploaded successfully",
      file: {
        id: fileRecord._id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
});

// VULNERABILITY: Path Traversal in file download
// User can specify any filename and access files outside the upload directory
app.get("/download/:filename", authenticateToken, async (req, res) => {
  try {
    const { filename } = req.params;

    // VULNERABILITY: No path sanitization - allows ../../../etc/passwd style attacks
    const filePath = path.join(__dirname, 'uploads', filename);
    
    console.log(`[DOWNLOAD] User ${req.user.username} requesting: ${filename}`);
    console.log(`[DOWNLOAD] Resolved path: ${filePath}`);

    // VULNERABILITY: No verification that path is within uploads directory
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    // Update download count (if file exists in DB)
    await File.findOneAndUpdate(
      { filename: filename },
      { $inc: { downloadCount: 1 } }
    );

    res.download(filePath, filename);
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ message: "Download failed" });
  }
});

// VULNERABILITY: Arbitrary File Read via path parameter
app.get("/view", authenticateToken, async (req, res) => {
  try {
    const { path: filePath } = req.query;

    if (!filePath) {
      return res.status(400).json({ message: "File path required" });
    }

    console.log(`[VIEW] User ${req.user.username} viewing: ${filePath}`);

    // VULNERABILITY: Reads any file path provided by user
    // No validation that file belongs to user or is in allowed directory
    const content = fs.readFileSync(filePath, 'utf8');

    res.status(200).json({
      message: "File content retrieved",
      path: filePath,
      content: content
    });
  } catch (error) {
    console.error("View error:", error);
    // VULNERABILITY: Leaks filesystem information in error messages
    res.status(500).json({ 
      message: "Error reading file",
      error: error.message,
      path: req.query.path
    });
  }
});

// VULNERABILITY: Command Injection via filename
// Processes files with user-controlled filenames in shell commands
app.post("/process/:fileId", authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { operation = "info" } = req.body;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) {
      return res.status(404).json({ message: "File not found" });
    }

    // VULNERABILITY: Uses filename in shell command without sanitization
    const filename = fileRecord.filename;
    const filePath = path.join(__dirname, 'uploads', filename);

    let command;
    switch (operation) {
      case "info":
        // VULNERABILITY: Command injection via filename
        command = `file "${filePath}"`;
        break;
      case "compress":
        command = `gzip -c "${filePath}" > "${filePath}.gz"`;
        break;
      case "hash":
        command = `md5sum "${filePath}"`;
        break;
      default:
        return res.status(400).json({ message: "Invalid operation" });
    }

    console.log(`[PROCESS] Executing: ${command}`);

    // VULNERABILITY: Executes shell command with user-controlled input
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Process error:", error);
        return res.status(500).json({ 
          message: "Processing failed",
          error: error.message,
          stderr: stderr
        });
      }

      res.status(200).json({
        message: "File processed successfully",
        operation: operation,
        output: stdout
      });
    });
  } catch (error) {
    console.error("Process error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// VULNERABILITY: Insecure Direct Object Reference (IDOR)
// Delete any file by ID without ownership verification
app.delete("/delete/:fileId", authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;

    const fileRecord = await File.findById(fileId);
    if (!fileRecord) {
      return res.status(404).json({ message: "File not found" });
    }

    // VULNERABILITY: No check if req.user.id === fileRecord.userId
    // Any authenticated user can delete any other user's files
    console.log(`[DELETE] User ${req.user.username} deleting file owned by userId: ${fileRecord.userId}`);

    // Delete physical file
    if (fs.existsSync(fileRecord.path)) {
      fs.unlinkSync(fileRecord.path);
    }

    // Delete database record
    await File.findByIdAndDelete(fileId);

    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Delete failed" });
  }
});

// VULNERABILITY: Directory Listing / Information Disclosure
// Lists all uploaded files with sensitive paths exposed
app.get("/files", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.query;

    // VULNERABILITY: If userId provided, shows that user's files (IDOR)
    // Otherwise shows current user's files
    const query = userId ? { userId } : { userId: req.user.id };

    const files = await File.find(query).select('-__v').sort({ createdAt: -1 });

    res.status(200).json({
      message: "Files retrieved",
      count: files.length,
      files: files
    });
  } catch (error) {
    console.error("Files list error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// VULNERABILITY: Public file access without authentication
// Exposes files marked as public to anyone
app.get("/public/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // VULNERABILITY: Path traversal in public endpoint
    const filePath = path.join(__dirname, 'uploads', filename);

    console.log(`[PUBLIC] Anonymous access to: ${filename}`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found" });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error("Public access error:", error);
    res.status(500).json({ message: "Access failed" });
  }
});

// VULNERABILITY: Archive extraction without validation
// Allows zip slip attacks
app.post("/extract", authenticateToken, upload.single('archive'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No archive uploaded" });
    }

    const extractPath = req.body.extractPath || path.join(__dirname, 'uploads', 'extracted');

    // VULNERABILITY: User-controlled extraction path
    console.log(`[EXTRACT] Extracting ${req.file.originalname} to ${extractPath}`);

    // Create extraction directory
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true });
    }

    // VULNERABILITY: Command injection via archive name and path
    const command = `unzip -o "${req.file.path}" -d "${extractPath}"`;
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({ 
          message: "Extraction failed",
          error: error.message 
        });
      }

      res.status(200).json({
        message: "Archive extracted successfully",
        path: extractPath,
        output: stdout
      });
    });
  } catch (error) {
    console.error("Extract error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Upload service is running on port http://localhost:${PORT}`);
});
