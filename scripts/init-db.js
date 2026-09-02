const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { dbConfig, requireAdminPassword } = require('../config/env');

async function initDatabase() {
  let connection;

  try {
    const password = requireAdminPassword();
    const username = process.env.ADMIN_USERNAME || 'admin';
    connection = await mysql.createConnection(dbConfig());

    console.log('Connected to MySQL database');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        card_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        bio TEXT,
        photo_url VARCHAR(500),
        snapchat VARCHAR(255),
        tiktok VARCHAR(255),
        whatsapp VARCHAR(255),
        linkedin VARCHAR(255),
        instagram VARCHAR(255),
        facebook VARCHAR(255),
        template VARCHAR(50) DEFAULT 'default',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_card_id (card_id)
      )
    `);
    console.log('Cards table created');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Admins table created');

    const [admins] = await connection.query('SELECT * FROM admins WHERE username = ?', [username]);

    if (admins.length === 0) {
      const hashedPassword = await bcrypt.hash(password, 12);
      await connection.query('INSERT INTO admins (username, password) VALUES (?, ?)', [username, hashedPassword]);
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    console.log('Database initialization completed successfully!');
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
