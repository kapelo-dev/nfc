const mysql = require('mysql2/promise');
require('dotenv').config();

const NEW_COLUMNS = [
  { name: 'print_status', ddl: "ADD COLUMN print_status VARCHAR(20) DEFAULT 'none' AFTER physical_style" },
  { name: 'sent_to_print_at', ddl: "ADD COLUMN sent_to_print_at TIMESTAMP NULL AFTER print_status" }
];

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

    for (const column of NEW_COLUMNS) {
      const [existing] = await connection.query('SHOW COLUMNS FROM cards LIKE ?', [column.name]);

      if (existing.length === 0) {
        await connection.query(`ALTER TABLE cards ${column.ddl}`);
        console.log(`${column.name} column added successfully`);
      } else {
        console.log(`${column.name} column already exists, skipping`);
      }
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
