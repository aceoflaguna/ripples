import pool from '../config/database.js';

class UserModel {
  // Create new user
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
        if (error.constraint?.includes('email')) {
          throw new Error('Email already exists');
        } else if (error.constraint?.includes('username')) {
          throw new Error('Username already exists');
        }
      }
      throw error;
    }
  }

  // Find user by email
  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email.toLowerCase()]);
    return result.rows[0];
  }

  // Find user by username
  static async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = $1';
    const result = await pool.query(query, [username]);
    return result.rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const query = `
      SELECT id, username, email, avatar_url, bio, karma, cake_day, 
             created_at, updated_at, last_login, is_active, email_verified
      FROM users WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Update user profile
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

  // Update user password
  static async updatePassword(id, passwordHash) {
    const query = 'UPDATE users SET password_hash = $2 WHERE id = $1';
    await pool.query(query, [id, passwordHash]);
  }

  // Update user karma
  static async updateKarma(id, delta) {
    const query = 'UPDATE users SET karma = karma + $2 WHERE id = $1 RETURNING karma';
    const result = await pool.query(query, [id, delta]);
    return result.rows[0];
  }

  // Update last login
  static async updateLastLogin(id) {
    const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
    await pool.query(query, [id]);
  }

  // Get user stats
  static async getUserStats(id) {
    const query = `
      SELECT 
        (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND is_deleted = FALSE) as post_count,
        (SELECT COUNT(*) FROM comments WHERE author_id = $1 AND is_deleted = FALSE) as comment_count,
        (SELECT COALESCE(SUM(score), 0) FROM posts WHERE author_id = $1 AND is_deleted = FALSE) as post_karma,
        (SELECT COALESCE(SUM(score), 0) FROM comments WHERE author_id = $1 AND is_deleted = FALSE) as comment_karma,
        (SELECT COUNT(*) FROM community_members WHERE user_id = $1) as community_count
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Get user post count
  static async getUserPostCount(id) {
    const query = 'SELECT COUNT(*) as count FROM posts WHERE author_id = $1 AND is_deleted = FALSE';
    const result = await pool.query(query, [id]);
    return parseInt(result.rows[0].count);
  }

  // Get user comment count
  static async getUserCommentCount(id) {
    const query = 'SELECT COUNT(*) as count FROM comments WHERE author_id = $1 AND is_deleted = FALSE';
    const result = await pool.query(query, [id]);
    return parseInt(result.rows[0].count);
  }

  // Follow user (optional feature)
  static async followUser(followerId, followingId) {
    const query = `
      INSERT INTO user_follows (follower_id, following_id)
      VALUES ($1, $2)
      ON CONFLICT (follower_id, following_id) DO NOTHING
      RETURNING *
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows[0];
  }

  // Unfollow user (optional feature)
  static async unfollowUser(followerId, followingId) {
    const query = `
      DELETE FROM user_follows 
      WHERE follower_id = $1 AND following_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows[0];
  }

  // Check if following
  static async isFollowing(followerId, followingId) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM user_follows 
        WHERE follower_id = $1 AND following_id = $2
      ) as is_following
    `;
    const result = await pool.query(query, [followerId, followingId]);
    return result.rows[0].is_following;
  }

  // Delete user (soft delete)
  static async deleteUser(id) {
    const query = `
      UPDATE users 
      SET is_active = FALSE, 
          email = CONCAT('deleted_', id, '@deleted.com'),
          username = CONCAT('deleted_', id)
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Hard delete user (permanent)
  static async hardDeleteUser(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

export default UserModel;