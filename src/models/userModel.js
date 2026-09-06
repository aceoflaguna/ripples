import pool from '../config/database.js';

class UserModel {
  // Create new user
  static async createUser(email, passwordHash) {
    const query = `
      INSERT INTO users (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at
    `;
    
    try {
      const result = await pool.query(query, [email.toLowerCase(), passwordHash]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email already exists');
      }
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const query = `
      SELECT id, email, password_hash, is_active, email_verified, created_at, updated_at
      FROM users
      WHERE email = $1
    `;
    
    try {
      const result = await pool.query(query, [email.toLowerCase()]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Find user by ID
  static async findById(id) {
    const query = `
      SELECT id, email, is_active, email_verified, created_at, updated_at
      FROM users
      WHERE id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Update last login
  static async updateLastLogin(id) {
    const query = `
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    
    try {
      await pool.query(query, [id]);
    } catch (error) {
      throw error;
    }
  }

  // Delete user
  static async deleteUser(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    
    try {
      const result = await pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}

export default UserModel;