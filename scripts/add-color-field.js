const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColorField() {
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
      "SHOW COLUMNS FROM cards LIKE 'theme_color'"
    );

    if (columns.length === 0) {
      await connection.query(
        "ALTER TABLE cards ADD COLUMN theme_color VARCHAR(7) DEFAULT '#42a5f5' AFTER template"
      );
      console.log('theme_color column added successfully');
    } else {
      console.log('theme_color column already exists');
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

addColorField();
