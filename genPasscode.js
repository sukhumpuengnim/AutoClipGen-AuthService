const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, 'database', 'auth.db');

// Create readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask question and get answer
function question(prompt, defaultValue) {
  return new Promise((resolve) => {
    rl.question(`${prompt} (default=${defaultValue}): `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Generate random passcode with [0-9][a-z][A-Z]
function generatePasscode(length) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let passcode = '';
  for (let i = 0; i < length; i++) {
    passcode += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return passcode;
}

// Type mapping
const TYPE_MONTHS_MAP = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '12': 12,
  '99': 99
};

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('🔐 Passcode Generator for Authentication Service');
  console.log('═══════════════════════════════════════════════\n');
  console.log('Type Options:');
  console.log('  1  = 1 month');
  console.log('  2  = 2 months');
  console.log('  3  = 3 months');
  console.log('  4  = 4 months');
  console.log('  5  = 5 months');
  console.log('  6  = 6 months');
  console.log('  12 = 12 months');
  console.log('  99 = 99 months');
  console.log('');

  try {
    // Get input parameters
    const digits = await question('Digits', '8');
    const type = await question('Type', '1');
    const count = await question('Passcode to create', '50');

    const length = parseInt(digits);
    const validityMonths = TYPE_MONTHS_MAP[type] || parseInt(type);
    const passcodeCount = parseInt(count);

    // Validate type
    if (!validityMonths || validityMonths < 1) {
      console.log('❌ Invalid type. Please use 1, 2, 3, 4, 5, 6, 12, or 99');
      rl.close();
      return;
    }

    console.log('\n📝 Configuration:');
    console.log(`   Length: ${length} characters`);
    console.log(`   Validity: ${validityMonths} month(s)`);
    console.log(`   Count: ${passcodeCount} passcodes`);
    console.log(`   Note: Expiry date will be calculated on first login`);

    // Confirm
    const confirm = await question('\nProceed? (yes/no)', 'yes');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ Cancelled.');
      rl.close();
      return;
    }

    // Open database
    console.log('\n🗄️  Opening database...');
    const db = new Database(dbPath);

    // Prepare insert statement
    const insert = db.prepare(`
      INSERT INTO passcodes (passcode, validity_months)
      VALUES (?, ?)
    `);

    // Generate and insert passcodes
    console.log('\n🔑 Generating passcodes...\n');
    const passcodes = [];
    let successCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < passcodeCount; i++) {
      const passcode = generatePasscode(length);

      try {
        insert.run(passcode, validityMonths);
        passcodes.push(passcode);
        successCount++;
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          duplicateCount++;
          i--; // Try again
        } else {
          console.error(`❌ Error inserting passcode: ${error.message}`);
        }
      }
    }

    db.close();

    // Display results
    console.log('═══════════════════════════════════════════════');
    console.log('✅ Passcode generation completed!');
    console.log('═══════════════════════════════════════════════');
    console.log(`Success: ${successCount} passcodes created`);
    if (duplicateCount > 0) {
      console.log(`Duplicates skipped: ${duplicateCount}`);
    }
    console.log(`Validity: ${validityMonths} month(s) from first login`);
    console.log('\n📋 Generated Passcodes:\n');

    // Display passcodes in columns
    const columns = 3;
    for (let i = 0; i < passcodes.length; i += columns) {
      const row = passcodes.slice(i, i + columns);
      console.log(row.map(p => `  ${p}`).join('    '));
    }

    console.log('\n═══════════════════════════════════════════════');
    console.log('💾 Passcodes saved to database successfully!');
    console.log('═══════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Run main function
main();
