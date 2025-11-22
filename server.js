const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 9998;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to 0.0.0.0 for VPS
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database', 'auth.db');

// CORS configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ['*']; // Allow all origins by default (change in production)

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allow all origins if '*' is specified
    if (allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Get database connection
function getDatabase() {
  return new Database(dbPath);
}

// Generate session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ===== API Endpoints =====

/**
 * POST /api/validate
 * Validate passcode and machine ID
 * Body: { passcode: string, machineId: string }
 */
app.post('/api/validate', (req, res) => {
  const { passcode, machineId } = req.body;

  if (!passcode || !machineId) {
    return res.status(400).json({
      success: false,
      error: 'Passcode and machineId are required'
    });
  }

  const db = getDatabase();

  try {
    // Find passcode
    const record = db.prepare(`
      SELECT * FROM passcodes WHERE passcode = ?
    `).get(passcode);

    // Log validation attempt
    const logStatus = record ? 'found' : 'not_found';
    db.prepare(`
      INSERT INTO validation_logs (passcode, machine_id, status, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(passcode, machineId, logStatus, req.ip);

    if (!record) {
      db.close();
      return res.status(401).json({
        success: false,
        error: 'Invalid passcode'
      });
    }

    // Check if passcode is already bound to different machine
    if (record.is_used && record.machine_id !== machineId) {
      db.prepare(`
        INSERT INTO validation_logs (passcode, machine_id, status, ip_address)
        VALUES (?, ?, ?, ?)
      `).run(passcode, machineId, 'machine_mismatch', req.ip);

      db.close();
      return res.status(403).json({
        success: false,
        error: 'Passcode already bound to different machine'
      });
    }

    let expiryDate = record.expiry_date;

    // Activate passcode if first time use
    if (!record.is_used) {
      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + record.validity_months);
      expiryDate = expiry.toISOString().split('T')[0]; // YYYY-MM-DD format

      db.prepare(`
        UPDATE passcodes
        SET is_used = 1, machine_id = ?, activated_at = CURRENT_TIMESTAMP, expiry_date = ?
        WHERE passcode = ?
      `).run(machineId, expiryDate, passcode);

      console.log(`✅ Passcode ${passcode} activated for machine ${machineId}, expires: ${expiryDate}`);
    }

    // Check expiry
    const now = new Date();
    const expiryDateObj = new Date(expiryDate);
    const isExpired = now > expiryDateObj;

    if (isExpired) {
      db.prepare(`
        INSERT INTO validation_logs (passcode, machine_id, status, ip_address)
        VALUES (?, ?, ?, ?)
      `).run(passcode, machineId, 'expired', req.ip);

      db.close();
      return res.status(403).json({
        success: false,
        error: 'Passcode expired',
        expiry_date: expiryDate
      });
    }

    // Update last validated time
    db.prepare(`
      UPDATE passcodes
      SET last_validated = CURRENT_TIMESTAMP
      WHERE passcode = ?
    `).run(passcode);

    // Create session token
    const sessionToken = generateSessionToken();
    const sessionExpiry = new Date();
    sessionExpiry.setHours(sessionExpiry.getHours() + 24); // 24 hours session

    db.prepare(`
      INSERT INTO sessions (passcode, machine_id, session_token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(passcode, machineId, sessionToken, sessionExpiry.toISOString());

    // Log success
    db.prepare(`
      INSERT INTO validation_logs (passcode, machine_id, status, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(passcode, machineId, 'success', req.ip);

    db.close();

    res.json({
      success: true,
      sessionToken,
      expiry_date: expiryDate,
      message: 'Authentication successful'
    });

  } catch (error) {
    db.close();
    console.error('Error during validation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/check-session
 * Check if session token is still valid
 * Body: { sessionToken: string, machineId: string }
 */
app.post('/api/check-session', (req, res) => {
  const { sessionToken, machineId } = req.body;

  if (!sessionToken || !machineId) {
    return res.status(400).json({
      success: false,
      error: 'sessionToken and machineId are required'
    });
  }

  const db = getDatabase();

  try {
    // Find session
    const session = db.prepare(`
      SELECT s.*, p.expiry_date, p.is_used
      FROM sessions s
      JOIN passcodes p ON s.passcode = p.passcode
      WHERE s.session_token = ? AND s.machine_id = ?
    `).get(sessionToken, machineId);

    if (!session) {
      db.close();
      return res.status(401).json({
        success: false,
        error: 'Invalid session'
      });
    }

    // Check session expiry
    const now = new Date();
    const sessionExpiry = new Date(session.expires_at);

    if (now > sessionExpiry) {
      db.close();
      return res.status(401).json({
        success: false,
        error: 'Session expired'
      });
    }

    // Check passcode expiry
    const passcodeExpiry = new Date(session.expiry_date);
    const isPasscodeExpired = now > passcodeExpiry;

    db.close();

    res.json({
      success: true,
      valid: true,
      expiry_date: session.expiry_date,
      is_expired: isPasscodeExpired,
      message: isPasscodeExpired ? 'Passcode expired but session valid' : 'Session valid'
    });

  } catch (error) {
    db.close();
    console.error('Error checking session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/stats
 * Get statistics (admin endpoint)
 */
app.get('/api/stats', (req, res) => {
  const db = getDatabase();

  try {
    const stats = {
      total_passcodes: db.prepare('SELECT COUNT(*) as count FROM passcodes').get().count,
      used_passcodes: db.prepare('SELECT COUNT(*) as count FROM passcodes WHERE is_used = 1').get().count,
      active_sessions: db.prepare('SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime("now")').get().count,
      expired_passcodes: db.prepare('SELECT COUNT(*) as count FROM passcodes WHERE expiry_date < date("now")').get().count
    };

    db.close();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    db.close();
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'auth-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Start server - Bind to 0.0.0.0 to accept external connections (important for VPS/Docker)
app.listen(PORT, HOST, () => {
  console.log('═══════════════════════════════════════════════');
  console.log('🔐 Authentication Service');
  console.log('═══════════════════════════════════════════════');
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`📍 Database: ${dbPath}`);
  console.log(`🔒 CORS Origins: ${allowedOrigins.join(', ')}`);
  console.log(`🌐 Endpoints:`);
  console.log(`   POST /api/validate`);
  console.log(`   POST /api/check-session`);
  console.log(`   GET  /api/stats`);
  console.log(`   GET  /api/health`);
  console.log('═══════════════════════════════════════════════\n');
});
