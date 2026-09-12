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

    const [columns] = await connection.query(
      "SHOW COLUMNS FROM cards LIKE 'fulfillment_status'"
    );

    if (columns.length === 0) {
      await connection.query(
        'ALTER TABLE cards ADD COLUMN fulfillment_status VARCHAR(20) DEFAULT NULL AFTER print_status'
      );
      console.log('fulfillment_status column added successfully');
    } else {
      console.log('fulfillment_status column already exists, skipping');
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
