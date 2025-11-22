# Authentication Service

Lightweight microservice for passcode-based authentication with machine ID binding.

## Features

- ✅ Passcode validation with expiry check
- ✅ Machine ID binding (one passcode = one machine)
- ✅ Session management
- ✅ SQLite database
- ✅ CLI tool for generating passcodes

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Initialize Database

```bash
npm run init-db
```

### 3. Generate Passcodes

```bash
npm run gen-passcode
```

Interactive prompts:
- **Digits**: Length of passcode (default: 8)
- **Expire**: Days until expiration (default: 30)
- **Passcode to create**: Number of passcodes to generate (default: 50)

### 4. Start Server

```bash
npm start
```

Server will run on port 9998 (or PORT from .env file).

## API Endpoints

### POST /api/validate

Validate passcode and create session.

**Request:**
```json
{
  "passcode": "Ab12Cd34",
  "machineId": "unique-machine-id"
}
```

**Response (Success):**
```json
{
  "success": true,
  "sessionToken": "abc123...",
  "expiry_date": "2025-12-31",
  "message": "Authentication successful"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid passcode | Passcode expired | Passcode already bound to different machine"
}
```

### POST /api/check-session

Check if session is still valid.

**Request:**
```json
{
  "sessionToken": "abc123...",
  "machineId": "unique-machine-id"
}
```

**Response:**
```json
{
  "success": true,
  "valid": true,
  "expiry_date": "2025-12-31",
  "is_expired": false,
  "message": "Session valid"
}
```

### GET /api/stats

Get service statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_passcodes": 50,
    "used_passcodes": 5,
    "active_sessions": 3,
    "expired_passcodes": 0
  }
}
```

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "success": true,
  "service": "auth-service",
  "status": "healthy",
  "timestamp": "2025-01-21T..."
}
```

## Database Schema

### passcodes
- `id` - Primary key
- `passcode` - Unique passcode string
- `machine_id` - Bound machine ID (null until first use)
- `expiry_date` - Expiration date
- `is_used` - Whether passcode has been activated
- `created_at` - Creation timestamp
- `activated_at` - First activation timestamp
- `last_validated` - Last validation timestamp

### sessions
- `id` - Primary key
- `passcode` - Associated passcode
- `machine_id` - Machine ID
- `session_token` - Unique session token
- `created_at` - Session creation timestamp
- `expires_at` - Session expiration (24 hours from creation)

### validation_logs
- `id` - Primary key
- `passcode` - Attempted passcode
- `machine_id` - Machine ID
- `status` - Validation status (success, failed, expired, etc.)
- `ip_address` - Client IP
- `timestamp` - Log timestamp

## Deployment

### VPS Deployment

1. Copy files to VPS
2. Install dependencies: `npm install`
3. Initialize database: `npm run init-db`
4. Generate passcodes: `npm run gen-passcode`
5. Set up environment variables (PORT)
6. Start with PM2: `pm2 start server.js --name auth-service`
7. Configure firewall to allow port 3000

### Security Considerations

- Run behind reverse proxy (nginx)
- Enable HTTPS
- Use firewall to restrict access
- Regular database backups
- Monitor validation logs for suspicious activity
