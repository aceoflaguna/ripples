import pool from '../config/database.js';

class PostModel {
  static async create(authorId, communityId, title, content, type, url = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        INSERT INTO posts (author_id, community_id, title, content, type, url)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await client.query(query, [authorId, communityId, title, content, type, url]);
      
      await client.query(
        'UPDATE communities SET post_count = post_count + 1 WHERE id = $1',
        [communityId]
      );
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async findById(id, userId = null) {
    const query = `
      SELECT p.*, 
             u.username as author_username,
             c.name as community_name,
             COALESCE(v.vote_type, 0) as user_vote
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      LEFT JOIN votes v ON p.id = v.post_id AND v.user_id = $2
      WHERE p.id = $1 AND p.is_deleted = FALSE
    `;
    const result = await pool.query(query, [id, userId]);
    return result.rows[0];
  }

  static async getFeed(userId = null, sortBy = 'hot', limit = 20, offset = 0) {
    let orderBy;
    
    switch(sortBy) {
      case 'new':
        orderBy = 'p.created_at DESC';
        break;
      case 'top':
        orderBy = 'p.score DESC';
        break;
      case 'controversial':
        orderBy = 'ABS(p.upvote_count - p.downvote_count) ASC';
        break;
      case 'hot':
      default:
        // Simplified hot algorithm based on score and recency
        orderBy = '(p.score * 1000) / EXTRACT(EPOCH FROM (NOW() - p.created_at)) DESC';
        break;
    }

    const query = `
      SELECT p.*, 
             u.username as author_username,
             c.name as community_name,
             COALESCE(v.vote_type, 0) as user_vote
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      LEFT JOIN votes v ON p.id = v.post_id AND v.user_id = $1
      WHERE p.is_deleted = FALSE
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  static async getCommunityPosts(communityId, sortBy = 'hot', limit = 20, offset = 0) {
    let orderBy;
    
    switch(sortBy) {
      case 'new':
        orderBy = 'p.created_at DESC';
        break;
      case 'top':
        orderBy = 'p.score DESC';
        break;
      case 'controversial':
        orderBy = 'ABS(p.upvote_count - p.downvote_count) ASC';
        break;
      case 'hot':
      default:
        orderBy = '(p.score * 1000) / EXTRACT(EPOCH FROM (NOW() - p.created_at)) DESC';
        break;
    }

    const query = `
      SELECT p.*, u.username as author_username
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.community_id = $1 AND p.is_deleted = FALSE
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [communityId, limit, offset]);
    return result.rows;
  }

  static async getUserPosts(userId, limit = 20, offset = 0) {
    const query = `
      SELECT p.*, u.username as author_username, c.name as community_name
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.author_id = $1 AND p.is_deleted = FALSE
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  static async update(id, updates) {
    const allowedFields = ['title', 'content', 'url'];
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
      UPDATE posts 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND is_deleted = FALSE
      RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async delete(id, authorId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        UPDATE posts 
        SET is_deleted = TRUE 
        WHERE id = $1 AND author_id = $2
        RETURNING *
      `;
      const result = await client.query(query, [id, authorId]);
      
      if (result.rows.length > 0) {
        await client.query(
          'UPDATE communities SET post_count = post_count - 1 WHERE id = $1',
          [result.rows[0].community_id]
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

  static async searchPosts(searchTerm, limit = 20, offset = 0) {
    const query = `
      SELECT p.*, u.username as author_username, c.name as community_name
      FROM posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.is_deleted = FALSE 
        AND (p.title ILIKE $1 OR p.content ILIKE $1)
      ORDER BY p.score DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [`%${searchTerm}%`, limit, offset]);
    return result.rows;
  }
}

export default PostModel;