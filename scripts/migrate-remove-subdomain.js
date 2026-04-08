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
      "SHOW COLUMNS FROM cards LIKE 'subdomain'"
    );

    if (columns.length > 0) {
      await connection.query('ALTER TABLE cards DROP COLUMN subdomain');
      console.log('Subdomain column removed successfully');
    } else {
      console.log('Subdomain column does not exist, skipping');
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
