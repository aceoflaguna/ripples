import pool from '../config/database.js';

class CommunityModel {
  static async create(name, description, creatorId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create community
      const communityQuery = `
        INSERT INTO communities (name, description, creator_id)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      const communityResult = await client.query(communityQuery, [name, description, creatorId]);
      const community = communityResult.rows[0];
      
      // Add creator as admin
      const memberQuery = `
        INSERT INTO community_members (community_id, user_id, role)
        VALUES ($1, $2, 'admin')
      `;
      await client.query(memberQuery, [community.id, creatorId]);
      
      await client.query('COMMIT');
      return community;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findByName(name) {
    const query = 'SELECT * FROM communities WHERE name = $1';
    const result = await pool.query(query, [name]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM communities WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async getAll(limit = 20, offset = 0) {
    const query = `
      SELECT c.*, u.username as creator_username
      FROM communities c
      LEFT JOIN users u ON c.creator_id = u.id
      ORDER BY c.member_count DESC, c.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  static async getUserCommunities(userId) {
    const query = `
      SELECT c.*, cm.role, cm.joined_at
      FROM communities c
      INNER JOIN community_members cm ON c.id = cm.community_id
      WHERE cm.user_id = $1
      ORDER BY cm.joined_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async joinCommunity(communityId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const memberQuery = `
        INSERT INTO community_members (community_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (community_id, user_id) DO NOTHING
        RETURNING *
      `;
      const memberResult = await client.query(memberQuery, [communityId, userId]);
      
      if (memberResult.rows.length > 0) {
        await client.query(
          'UPDATE communities SET member_count = member_count + 1 WHERE id = $1',
          [communityId]
        );
      }
      
      await client.query('COMMIT');
      return memberResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async leaveCommunity(communityId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const leaveQuery = `
        DELETE FROM community_members 
        WHERE community_id = $1 AND user_id = $2
        RETURNING *
      `;
      const result = await client.query(leaveQuery, [communityId, userId]);
      
      if (result.rows.length > 0) {
        await client.query(
          'UPDATE communities SET member_count = member_count - 1 WHERE id = $1',
          [communityId]
        );
      }
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getMemberRole(communityId, userId) {
    const query = `
      SELECT role FROM community_members 
      WHERE community_id = $1 AND user_id = $2
    `;
    const result = await pool.query(query, [communityId, userId]);
    return result.rows[0]?.role;
  }

  static async searchCommunities(searchTerm, limit = 20) {
    const query = `
      SELECT * FROM communities 
      WHERE name ILIKE $1 OR description ILIKE $1
      ORDER BY member_count DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [`%${searchTerm}%`, limit]);
    return result.rows;
  }
}

export default CommunityModel;