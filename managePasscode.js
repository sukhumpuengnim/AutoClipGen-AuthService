const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'database', 'auth.db');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Get database connection
function getDatabase() {
  return new Database(dbPath);
}

// List all passcodes
function listPasscodes() {
  const db = getDatabase();

  const passcodes = db.prepare(`
    SELECT
      passcode,
      validity_months,
      is_used,
      machine_id,
      expiry_date,
      activated_at,
      last_validated
    FROM passcodes
    ORDER BY created_at DESC
  `).all();

  db.close();

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('📋 Passcode List');
  console.log('═══════════════════════════════════════════════════════════════════════');

  if (passcodes.length === 0) {
    console.log('No passcodes found.');
    return;
  }

  passcodes.forEach((p, idx) => {
    const status = !p.is_used ? '🆕 NEW' :
                   (new Date() > new Date(p.expiry_date) ? '❌ EXPIRED' : '✅ ACTIVE');

    console.log(`\n${idx + 1}. ${p.passcode}`);
    console.log(`   Status: ${status}`);
    console.log(`   Validity: ${p.validity_months} month(s)`);
    console.log(`   Expiry: ${p.expiry_date || 'Not activated yet'}`);
    console.log(`   Machine ID: ${p.machine_id || 'Not bound'}`);
    if (p.activated_at) {
      console.log(`   Activated: ${new Date(p.activated_at).toLocaleString()}`);
    }
    if (p.last_validated) {
      console.log(`   Last Used: ${new Date(p.last_validated).toLocaleString()}`);
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════════════════\n');
}

// View specific passcode details
function viewPasscode(passcode) {
  const db = getDatabase();

  const record = db.prepare(`
    SELECT * FROM passcodes WHERE passcode = ?
  `).get(passcode);

  if (!record) {
    console.log(`\n❌ Passcode "${passcode}" not found.\n`);
    db.close();
    return;
  }

  // Get sessions
  const sessions = db.prepare(`
    SELECT * FROM sessions WHERE passcode = ?
  `).all(passcode);

  // Get validation logs
  const logs = db.prepare(`
    SELECT * FROM validation_logs
    WHERE passcode = ?
    ORDER BY timestamp DESC
    LIMIT 10
  `).all(passcode);

  db.close();

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 Passcode Details');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Passcode: ${record.passcode}`);
  console.log(`Validity: ${record.validity_months} month(s)`);
  console.log(`Used: ${record.is_used ? 'Yes' : 'No'}`);
  console.log(`Machine ID: ${record.machine_id || 'Not bound'}`);
  console.log(`Expiry Date: ${record.expiry_date || 'Not activated yet'}`);
  console.log(`Created: ${new Date(record.created_at).toLocaleString()}`);
  if (record.activated_at) {
    console.log(`Activated: ${new Date(record.activated_at).toLocaleString()}`);
  }
  if (record.last_validated) {
    console.log(`Last Validated: ${new Date(record.last_validated).toLocaleString()}`);
  }

  console.log(`\n📊 Active Sessions: ${sessions.length}`);
  sessions.forEach((s, idx) => {
    console.log(`   ${idx + 1}. Session: ${s.session_token.substring(0, 16)}...`);
    console.log(`      Machine: ${s.machine_id}`);
    console.log(`      Expires: ${new Date(s.expires_at).toLocaleString()}`);
  });

  console.log(`\n📜 Recent Validation Logs (Last 10):`);
  logs.forEach((log, idx) => {
    console.log(`   ${idx + 1}. [${log.status}] ${new Date(log.timestamp).toLocaleString()}`);
    console.log(`      Machine: ${log.machine_id}`);
    console.log(`      IP: ${log.ip_address || 'N/A'}`);
  });

  console.log('═══════════════════════════════════════════════════════════════════════\n');
}

// Unbind/Reset passcode
async function unbindPasscode(passcode) {
  const db = getDatabase();

  const record = db.prepare(`
    SELECT * FROM passcodes WHERE passcode = ?
  `).get(passcode);

  if (!record) {
    console.log(`\n❌ Passcode "${passcode}" not found.\n`);
    db.close();
    return;
  }

  if (!record.is_used) {
    console.log(`\n⚠️  Passcode "${passcode}" is not bound to any machine yet.\n`);
    db.close();
    return;
  }

  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('⚠️  WARNING: Unbind Passcode');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`Passcode: ${record.passcode}`);
  console.log(`Currently Bound to Machine: ${record.machine_id}`);
  console.log(`Validity: ${record.validity_months} month(s)`);
  console.log(`Expiry Date: ${record.expiry_date}`);
  console.log('\nThis will:');
  console.log('  1. Remove machine binding (set is_used = 0, machine_id = NULL)');
  console.log('  2. Keep the original expiry date');
  console.log('  3. Revoke all active sessions');
  console.log('  4. Allow this passcode to be used on a different machine');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const confirm = await question('Are you sure you want to unbind this passcode? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('❌ Operation cancelled.\n');
    db.close();
    return;
  }

  // Unbind passcode - keep expiry_date but reset binding
  db.prepare(`
    UPDATE passcodes
    SET is_used = 0, machine_id = NULL
    WHERE passcode = ?
  `).run(passcode);

  // Revoke all sessions
  const deletedSessions = db.prepare(`
    DELETE FROM sessions WHERE passcode = ?
  `).run(passcode);

  // Log the unbind action
  db.prepare(`
    INSERT INTO validation_logs (passcode, machine_id, status, ip_address)
    VALUES (?, ?, ?, ?)
  `).run(passcode, record.machine_id, 'unbound_by_admin', 'CLI');

  db.close();

  console.log('\n✅ Passcode unbound successfully!');
  console.log(`   - Machine binding removed`);
  console.log(`   - ${deletedSessions.changes} session(s) revoked`);
  console.log(`   - Passcode can now be used on a different machine`);
  console.log(`   - Expiry date (${record.expiry_date}) is preserved\n`);
}

// Main menu
async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔧 Passcode Management Tool');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('Options:');
  console.log('  1. List all passcodes');
  console.log('  2. View passcode details');
  console.log('  3. Unbind/Reset passcode (allow device change)');
  console.log('  4. Exit');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  try {
    const choice = await question('Choose option (1-4): ');

    switch (choice) {
      case '1':
        listPasscodes();
        break;

      case '2':
        const viewCode = await question('Enter passcode: ');
        viewPasscode(viewCode);
        break;

      case '3':
        const unbindCode = await question('Enter passcode to unbind: ');
        await unbindPasscode(unbindCode);
        break;

      case '4':
        console.log('👋 Goodbye!\n');
        rl.close();
        return;

      default:
        console.log('❌ Invalid option.\n');
    }

    // Ask if user wants to continue
    const continueChoice = await question('Do you want to perform another operation? (yes/no): ');
    if (continueChoice.toLowerCase() === 'yes' || continueChoice.toLowerCase() === 'y') {
      console.log(''); // Empty line
      await main(); // Recursive call to show menu again
    } else {
      console.log('👋 Goodbye!\n');
      rl.close();
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    rl.close();
  }
}

// Run main function
main();
