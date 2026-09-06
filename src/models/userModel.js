import pool from '../config/database.js';

class UserModel {
  static async createUser(username, email, passwordHash) {
    const query = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, created_at
    `;
    
    try {
      const result = await pool.query(query, [username, email.toLowerCase(), passwordHash]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        if (error.constraint.includes('email')) {
          throw new Error('Email already exists');
        } else if (error.constraint.includes('username')) {
          throw new Error('Username already exists');
        }
      }
      throw error;
    }
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email.toLowerCase()]);
    return result.rows[0];
  }

  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT id, username, email, avatar_url, bio, karma, cake_day, 
             created_at, updated_at, is_active
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async updateProfile(id, updates) {
    const allowedFields = ['username', 'avatar_url', 'bio'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return null;
    }

    values.push(id);
    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, avatar_url, bio, karma, created_at, updated_at
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async updateKarma(id, delta) {
    const query = 'UPDATE users SET karma = karma + $2 WHERE id = $1 RETURNING karma';
    const result = await pool.query(query, [id, delta]);
    return result.rows[0];
  }

  static async updateLastLogin(id) {
    const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await pool.query(query, [id]);
  }

  static async getUserStats(id) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM posts WHERE author_id = $1) as post_count,
        (SELECT COUNT(*) FROM comments WHERE author_id = $1) as comment_count,
        (SELECT COALESCE(SUM(score), 0) FROM posts WHERE author_id = $1) as post_karma,
        (SELECT COALESCE(SUM(score), 0) FROM comments WHERE author_id = $1) as comment_karma
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

export default UserModel;