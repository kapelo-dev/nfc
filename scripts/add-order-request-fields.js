const mysql = require('mysql2/promise');
require('dotenv').config();

const NEW_COLUMNS = [
  { name: 'is_request', ddl: "ADD COLUMN is_request BOOLEAN DEFAULT FALSE AFTER is_active" },
  { name: 'contact_email', ddl: "ADD COLUMN contact_email VARCHAR(255) AFTER is_request" },
  { name: 'contact_phone', ddl: "ADD COLUMN contact_phone VARCHAR(30) AFTER contact_email" },
  { name: 'snapchat_photo', ddl: "ADD COLUMN snapchat_photo VARCHAR(500) AFTER snapchat" },
  { name: 'tiktok_photo', ddl: "ADD COLUMN tiktok_photo VARCHAR(500) AFTER tiktok" },
  { name: 'whatsapp_photo', ddl: "ADD COLUMN whatsapp_photo VARCHAR(500) AFTER whatsapp" },
  { name: 'linkedin_photo', ddl: "ADD COLUMN linkedin_photo VARCHAR(500) AFTER linkedin" },
  { name: 'instagram_photo', ddl: "ADD COLUMN instagram_photo VARCHAR(500) AFTER instagram" },
  { name: 'facebook_photo', ddl: "ADD COLUMN facebook_photo VARCHAR(500) AFTER facebook" }
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
