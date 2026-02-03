# AGENTS.md

This document provides essential information for agentic coding assistants working on this microservice application.

## Build, Lint, and Test Commands

### Development Commands
- **Start all services**: `npm run dev` (runs both auth and setting services concurrently)
- **Start auth service only**: `npm run server` (runs `npm run test --prefix auth`)
- **Start setting service only**: `npm run client` (runs `npm run dev --prefix setting`)

### Individual Service Commands

#### Auth Service (`/auth`)
- **Development**: `npm run test` (uses nodemon to watch authController.js)
- **Production**: `npm run start` (runs node authController.js)
- **Default port**: 3000

#### Setting Service (`/setting`)
- **Development**: `npm run dev` (uses nodemon to watch userSetting.js)
- **Production**: `npm run start` (runs node userSetting.js)
- **Default port**: 4000

### Database Operations
- **Run migrations**: `node db/migrate.js` (executes MongoDB migrations from db/migrations/)

### Environment Setup
Required environment variables (create `.env` file):
- `MONGO_URI`: MongoDB connection string
- `MONGO_DB_NAME`: Database name (defaults to "microservices")
- `JWT_SECRET`: JWT signing secret
- `NODE_ENV`: Environment (development/production)
- `user`: Gmail address for password reset emails
- `pass`: Gmail app password for password reset emails

## Architecture Overview

This is a Node.js microservice application with two main services:
1. **Auth Service** (`/auth`): Handles user authentication, registration, login, password reset
2. **Setting Service** (`/setting`): Manages user settings, preferences, profile management

Both services use Express.js with MongoDB (via Mongoose) and share common authentication patterns.

## Code Style Guidelines

### General Patterns
- **Language**: JavaScript (CommonJS modules - `require()`/`module.exports`)
- **Runtime**: Node.js (>=18)
- **Database**: MongoDB with Mongoose ODM
- **Framework**: Express.js
- **Authentication**: JWT with httpOnly cookies

### Import and Export Conventions
```javascript
// Use CommonJS require syntax
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");

// Export with module.exports
module.exports = {
  // export object
};
```

### File Organization
- Service entry points use descriptive names (`authController.js`, `userSetting.js`)
- Database migrations in `/db/migrations/` with numeric prefixes (`001-*.js`)
- Shared configuration in `defaultSettings.js`
- Each service has its own `package.json`

### Express App Structure
```javascript
// Standard startup sequence
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ['http://localhost', 'http://localhost:80', 'http://frontend'],
  credentials: true
}));

// Database connection
mongoose.connect(mongoURI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("Error connecting to MongoDB:", error));

// Routes
// ... route definitions

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Mongoose Schema Patterns
```javascript
const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
}, { versionKey: false, timestamps: true });

const User = mongoose.model("User", userSchema);
```

### Authentication Middleware
```javascript
function authenticateToken(req, res, next) {
  const token = req.cookies.token;
  
  if (token == null) return res.sendStatus(401);
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
```

### Error Handling Patterns
- Use try-catch blocks for async operations
- Return appropriate HTTP status codes with JSON responses
- Log errors to console for debugging
- Consistent error response format: `{ message: "Error description" }`

### Route Handler Structure
```javascript
app.post("/endpoint", async (req, res) => {
  try {
    // Input validation
    if (!req.body || !requiredField) {
      return res.status(400).json({ message: "Bad Request - Missing required fields" });
    }
    
    // Business logic
    const result = await someOperation();
    
    // Success response
    res.status(200).json({ message: "Success", data: result });
  } catch (error) {
    console.error("Operation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
```

### CORS Configuration
Always use this CORS setup for cross-origin requests:
```javascript
app.use(cors({
  origin: ['http://localhost', 'http://localhost:80', 'http://frontend'],
  credentials: true
}));
```

### Health Endpoints
Each service should include a health check endpoint:
```javascript
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});
```

### Security Considerations
- JWT tokens stored in httpOnly cookies
- Input validation on all routes
- Password comparison (note: current code stores plaintext passwords - vulnerable by design for this security training application)
- CORS properly configured
- Environment variables for sensitive data

### Database Migration Format
Migrations use CommonJS exports:
```javascript
// export async function up(db) {
//   await db.createCollection("name", {
//     validator: { /* schema validation */ }
//   });
//   await db.collection("name").createIndexes([/* indexes */]);
// }
```

### Naming Conventions
- **Files**: camelCase for JavaScript files (`authController.js`, `userSetting.js`)
- **Variables**: camelCase (`userId`, `userName`)
- **Endpoints**: kebab-case for URLs (`/user/change-name`)
- **Constants**: UPPER_SNAKE_CASE for environment variables (`MONGO_URI`, `JWT_SECRET`)
- **Models**: PascalCase for Mongoose models (`User`, `Settings`)

### Console Output
- Use console.log for success/connection messages
- Use console.error for errors
- Include meaningful context in log messages
- Audit important security operations with `[AUDIT]` prefix

### Response Format Standards
- Success: `{ message: "Description", data?: {} }`
- Error: `{ message: "Error description" }`
- Status codes: 200 (success), 201 (created), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error)

This application is designed as a vulnerable microservice for security training purposes. When making changes, maintain the intended vulnerable patterns for educational value while following the established code structure.