const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'nfc_cards_db',
      port: process.env.DB_PORT || 3306
    });

    console.log('Connected to MySQL database');

    const [statusColumns] = await connection.query("SHOW COLUMNS FROM cards LIKE 'payment_status'");
    if (statusColumns.length === 0) {
      await connection.query('ALTER TABLE cards ADD COLUMN payment_status VARCHAR(20) DEFAULT NULL');
      console.log('payment_status column added successfully');
    } else {
      console.log('payment_status column already exists, skipping');
    }

    const [referenceColumns] = await connection.query("SHOW COLUMNS FROM cards LIKE 'payment_reference'");
    if (referenceColumns.length === 0) {
      await connection.query('ALTER TABLE cards ADD COLUMN payment_reference VARCHAR(100) DEFAULT NULL');
      console.log('payment_reference column added successfully');
    } else {
      console.log('payment_reference column already exists, skipping');
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrateDatabase();
