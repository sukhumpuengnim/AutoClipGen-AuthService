const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'database');
const dbPath = path.join(dbDir, 'auth.db');

// Ensure database directory exists
if (!fs.existsSync(dbDir)) {
  console.log('📁 Creating database directory...');
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('🗄️  Initializing authentication database...');

const db = new Database(dbPath);

// Create passcodes table
db.exec(`
  CREATE TABLE IF NOT EXISTS passcodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passcode TEXT NOT NULL UNIQUE,
    machine_id TEXT,
    validity_months INTEGER NOT NULL,
    expiry_date DATE,
    is_used BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    activated_at DATETIME,
    last_validated DATETIME
  )
`);

// Create sessions table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passcode TEXT NOT NULL,
    machine_id TEXT NOT NULL,
    session_token TEXT NOT NULL UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (passcode) REFERENCES passcodes (passcode)
  )
`);

// Create validation logs table
db.exec(`
  CREATE TABLE IF NOT EXISTS validation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    passcode TEXT,
    machine_id TEXT,
    status TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Create indexes
db.exec(`CREATE INDEX IF NOT EXISTS idx_passcodes_passcode ON passcodes(passcode)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_passcodes_machine_id ON passcodes(machine_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_passcode ON sessions(passcode)`);

db.close();

console.log('✅ Database initialized successfully!');
console.log('📋 Tables created: passcodes, sessions, validation_logs');
console.log('📍 Database location:', dbPath);
