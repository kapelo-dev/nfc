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

    const [tables] = await connection.query("SHOW TABLES LIKE 'transactions'");
    if (tables.length === 0) {
      await connection.query(`
        CREATE TABLE transactions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          card_id INT DEFAULT NULL,
          reference VARCHAR(100) DEFAULT NULL,
          amount INT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          payment_method VARCHAR(50) DEFAULT NULL,
          contact_phone VARCHAR(30) DEFAULT NULL,
          card_name VARCHAR(255) DEFAULT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_reference (reference),
          INDEX idx_card_id (card_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('transactions table created successfully');
    } else {
      console.log('transactions table already exists, skipping');
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
