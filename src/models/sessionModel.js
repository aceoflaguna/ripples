import pool from '../config/database.js';

class SessionModel {
  // Create new session
  static async createSession(userId, refreshToken, accessToken, metadata = {}) {
    const query = `
      INSERT INTO user_sessions (
        user_id, 
        refresh_token, 
        access_token,
        user_agent, 
        ip_address, 
        device_info,
        expires_at,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING *
    `;
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
    
    const values = [
      userId,
      refreshToken,
      accessToken,
      metadata.userAgent || null,
      metadata.ipAddress || null,
      metadata.deviceInfo || null,
      expiresAt
    ];
    
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Create session error:', error);
      throw error;
    }
  }

  // Find session by refresh token
  static async findByRefreshToken(refreshToken) {
    const query = `
      SELECT * FROM user_sessions 
      WHERE refresh_token = $1 
        AND is_active = TRUE
        AND expires_at > CURRENT_TIMESTAMP
    `;
    
    try {
      const result = await pool.query(query, [refreshToken]);
      return result.rows[0];
    } catch (error) {
      console.error('Find session by refresh token error:', error);
      throw error;
    }
  }

  // Find session by access token
  static async findByAccessToken(accessToken) {
    const query = `
      SELECT * FROM user_sessions 
      WHERE access_token = $1 
        AND is_active = TRUE
        AND expires_at > CURRENT_TIMESTAMP
    `;
    
    try {
      const result = await pool.query(query, [accessToken]);
      return result.rows[0];
    } catch (error) {
      console.error('Find session by access token error:', error);
      throw error;
    }
  }

  // Get all active sessions for a user
  // static async getUserSessions(userId) {
  //   const query = `
  //     SELECT 
  //       id,
  //       user_agent,
  //       ip_address,
  //       device_info,
  //       is_active,
  //       expires_at,
  //       last_used_at,
  //       created_at,
  //       revoked_at,
  //       revocation_reason
  //     FROM user_sessions 
  //     WHERE user_id = $1 
  //       AND is_active = TRUE
  //       AND expires_at > CURRENT_TIMESTAMP
  //     ORDER BY last_used_at DESC
  //   `;
    
  //   try {
  //     const result = await pool.query(query, [userId]);
  //     return result.rows;
  //   } catch (error) {
  //     console.error('Get user sessions error:', error);
  //     throw error;
  //   }
  // }

  // Update session last used timestamp
  static async updateLastUsed(sessionId, accessToken = null) {
    const query = `
      UPDATE user_sessions 
      SET last_used_at = CURRENT_TIMESTAMP,
          access_token = COALESCE($2, access_token)
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [sessionId, accessToken]);
      return result.rows[0];
    } catch (error) {
      console.error('Update session last used error:', error);
      throw error;
    }
  }

  // logout a specific session
  static async revokeSession(sessionId, reason = 'logout') {
    const query = `
      UPDATE user_sessions 
      SET is_active = FALSE,
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = $2
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [sessionId, reason]);
      return result.rows[0];
    } catch (error) {
      console.error('Revoke session error:', error);
      throw error;
    }
  }

  // Revoke session by refresh token
  static async revokeByRefreshToken(refreshToken, reason = 'logout') {
    const query = `
      UPDATE user_sessions 
      SET is_active = FALSE,
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = $2
      WHERE refresh_token = $1
        AND is_active = TRUE
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [refreshToken, reason]);
      return result.rows[0];
    } catch (error) {
      console.error('Revoke by refresh token error:', error);
      throw error;
    }
  }

  // Revoke all sessions for a user
  static async revokeAllUserSessions(userId, reason = 'security_concern') {
    const query = `
      UPDATE user_sessions 
      SET is_active = FALSE,
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = $2
      WHERE user_id = $1
        AND is_active = TRUE
      RETURNING id
    `;
    
    try {
      const result = await pool.query(query, [userId, reason]);
      return result.rows;
    } catch (error) {
      console.error('Revoke all user sessions error:', error);
      throw error;
    }
  }

  // Delete expired sessions (cleanup)
  static async cleanupExpiredSessions() {
    const query = `
      DELETE FROM user_sessions 
      WHERE expires_at < CURRENT_TIMESTAMP - INTERVAL '30 days'
    `;
    
    try {
      const result = await pool.query(query);
      return result.rowCount;
    } catch (error) {
      console.error('Cleanup expired sessions error:', error);
      throw error;
    }
  }

  // Check if session is valid
  static async isValidSession(refreshToken) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM user_sessions 
        WHERE refresh_token = $1 
          AND is_active = TRUE
          AND expires_at > CURRENT_TIMESTAMP
      ) as is_valid
    `;
    
    try {
      const result = await pool.query(query, [refreshToken]);
      return result.rows[0].is_valid;
    } catch (error) {
      console.error('Check session validity error:', error);
      throw error;
    }
  }

  // Get session count for user
  static async getSessionCount(userId) {
    const query = `
      SELECT COUNT(*) as count 
      FROM user_sessions 
      WHERE user_id = $1 
        AND is_active = TRUE
        AND expires_at > CURRENT_TIMESTAMP
    `;
    
    try {
      const result = await pool.query(query, [userId]);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Get session count error:', error);
      throw error;
    }
  }

  // Update session with new refresh token (token rotation)
  static async rotateRefreshToken(oldRefreshToken, newRefreshToken, newAccessToken) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Deactivate old session
      const revokeQuery = `
        UPDATE user_sessions 
        SET is_active = FALSE,
            revoked_at = CURRENT_TIMESTAMP,
            revocation_reason = 'token_rotation'
        WHERE refresh_token = $1
        RETURNING *
      `;
      const oldSession = await client.query(revokeQuery, [oldRefreshToken]);
      
      if (oldSession.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      
      // Create new session with rotated token
      const createQuery = `
        INSERT INTO user_sessions (
          user_id, 
          refresh_token, 
          access_token,
          user_agent, 
          ip_address, 
          device_info,
          expires_at,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        RETURNING *
      `;
      
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const newSession = await client.query(createQuery, [
        oldSession.rows[0].user_id,
        newRefreshToken,
        newAccessToken,
        oldSession.rows[0].user_agent,
        oldSession.rows[0].ip_address,
        oldSession.rows[0].device_info,
        expiresAt
      ]);
      
      await client.query('COMMIT');
      return newSession.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Rotate refresh token error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get session statistics for admin
  static async getSessionStats() {
    const query = `
      SELECT 
        COUNT(*) as total_sessions,
        COUNT(*) FILTER (WHERE is_active = TRUE AND expires_at > CURRENT_TIMESTAMP) as active_sessions,
        COUNT(*) FILTER (WHERE is_active = FALSE) as revoked_sessions,
        COUNT(DISTINCT user_id) as unique_users
      FROM user_sessions
    `;
    
    try {
      const result = await pool.query(query);
      return result.rows[0];
    } catch (error) {
      console.error('Get session stats error:', error);
      throw error;
    }
  }
}

export default SessionModel;