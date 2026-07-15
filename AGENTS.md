# AGENTS.md

This document provides essential information for agentic coding assistants working on this microservice application.

## Build, Lint, and Test Commands

### Development Commands
- **Start all services**: `npm run dev` (runs `server`, `frontend`, `client`, `notification`, `upload` concurrently)
- **Start auth service only**: `npm run server` (runs `npm run test --prefix auth`)
- **Start setting service only**: `npm run client` (runs `npm run dev --prefix setting`)
- **Start frontend**: `npm run frontend` (runs `live-server`)

### Individual Service Commands & Tests

**Note on Testing**: This project currently **does not have an automated unit test suite** (no Jest/Mocha).
- `npm run test` in `/auth` actually runs the server with `nodemon`, it is NOT a test runner.
- **To run a single test**: You must currently verify changes manually or create a temporary script (e.g., using `fetch` or `axios`) to hit the endpoints.
- **To lint**: No linter is configured. Follow the code style below strictly.

#### Auth Service (`/auth`)
- **Run (Dev)**: `npm run test` (watch mode)
- **Run (Prod)**: `npm run start`
- **Port**: 3000

#### Setting Service (`/setting`)
- **Run (Dev)**: `npm run dev` (watch mode)
- **Run (Prod)**: `npm run start`
- **Port**: 4000

#### Frontend (`/frontend`)
- **Run**: `npm start` (uses `live-server`)
- **Port**: 8080 (default)

### Database
- **Migrations**: `node db/migrate.js`
- **Connection**: Requires `MONGO_URI` in `.env`.

## Code Style Guidelines

### General Patterns
- **Language**: JavaScript (Node.js >=18)
- **Module System**: CommonJS (`require`/`module.exports`)
- **Database**: MongoDB with Mongoose
- **Framework**: Express.js

### Formatting & Syntax
- **Indentation**: 2 spaces.
- **Semicolons**: Yes, always.
- **Quotes**: Double quotes (`"`) preferred.
- **Files**: `camelCase.js` (e.g., `authController.js`).
- **Variables**: `camelCase`.
- **Constants**: `UPPER_SNAKE_CASE`.

### Imports
```javascript
require("dotenv").config();
const express = require("express");
// Group imports: Built-in -> Third-party -> Local
```

### Error Handling
- Use `try/catch` for async route handlers.
- Return JSON errors with 4xx/5xx status.
- **Pattern**:
  ```javascript
  try {
    // logic
  } catch (error) {
    console.error("Error context:", error);
    res.status(500).json({ message: "Server error" });
  }
  ```

### Mongoose Models
- Use `PascalCase` for models.
- Disable version key, enable timestamps.
```javascript
const userSchema = new mongoose.Schema({
  // fields
}, { versionKey: false, timestamps: true });
```

### Security & Vulnerabilities
**IMPORTANT**: This is a *vulnerable-by-design* application.
- Do **NOT** fix vulnerabilities labeled with `// VULNERABILITY` unless explicitly asked.
- When creating new features, maintain the existing patterns.
- If asked to fix, apply standard mitigations (bcrypt, input validation, etc.).

## Environment Variables (.env)
- `MONGO_URI`: Connection string.
- `JWT_SECRET`: Secret for tokens.
- `NODE_ENV`: `development` or `production`.
- `PORT`: Service port (3000/4000).

## Service Overview & API Endpoints

### Auth Service (`/auth`) - Port 3000
Handles registration, login, and password reset.
- `POST /signup`: Register a new user.
- `POST /login`: Authenticate user (returns JWT in httpOnly cookie).
- `POST /password-reset/request`: Request a reset token.
- `POST /reset-password`: Reset password using token or email.
- `GET /health`: Health check.

### Setting Service (`/setting`) - Port 4000
Manages user profiles and settings. Requires `authenticateToken` middleware.
- `GET /me`: Get current user profile.
- `PUT /user/change-name`: Update username/display name.
- `PUT /user/change-password`: Change password (authenticated).
- `POST /settings/reset`: Reset user settings.

### Notification Service (`/notification`)
Handles email, SMS, and push notifications.
- `POST /send/email`: Send generic email.
- `POST /send/sms/xml`: Send SMS (XXE vulnerable endpoint).
- `POST /template/create` & `/template/send`: Manage SSTI vulnerable templates.
- `POST /webhook/trigger`: Trigger webhooks (SSRF vulnerable).
- `GET /notifications/:userId`: Retrieve user notifications.

### Upload Service (`/upload`)
Handles file uploads and processing.
- `POST /upload`: Upload file (unrestricted file upload).
- `POST /process/:fileId`: Process uploaded file (Command Injection).
- `POST /extract`: Extract archive (Zip Slip).
- `GET /files`: List files.
- `GET /public/:filename`: Access public files.

## Testing Strategy for Agents
Since there are no automated tests:
1.  **Analyze**: Read the code to understand the expected behavior.
2.  **Verify**: Create a temporary script (e.g., `temp-test.js`) using `axios` to send requests to the running service.
    ```javascript
    const axios = require('axios');
    axios.post('http://localhost:3000/login', { ... })
      .then(res => console.log(res.data))
      .catch(err => console.error(err.response.data));
    ```
3.  **Cleanup**: Delete temporary test scripts after verification.
