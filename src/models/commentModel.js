import pool from '../config/database.js';

class CommentModel {
  // Create new comment
  static async create(content, authorId, postId, parentCommentId = null) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Calculate depth
      let depth = 0;
      if (parentCommentId) {
        const depthQuery = 'SELECT depth FROM comments WHERE id = $1';
        const depthResult = await client.query(depthQuery, [parentCommentId]);
        if (depthResult.rows.length > 0) {
          depth = depthResult.rows[0].depth + 1;
        }
      }
      
      // Insert comment
      const query = `
        INSERT INTO comments (content, author_id, post_id, parent_comment_id, depth)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await client.query(query, [content, authorId, postId, parentCommentId, depth]);
      const comment = result.rows[0];
      
      // Update post comment count
      await client.query(
        'UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1',
        [postId]
      );
      
      // Update parent comment reply count
      if (parentCommentId) {
        await client.query(
          'UPDATE comments SET reply_count = reply_count + 1 WHERE id = $1',
          [parentCommentId]
        );
      }
      
      await client.query('COMMIT');
      return comment;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Find comment by ID with author info
  static async findById(id) {
    const query = `
      SELECT c.*, 
             u.username as author_username,
             u.avatar_url as author_avatar
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = $1 AND c.is_deleted = FALSE
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Find comment by ID (including deleted)
  static async findByIdIncludeDeleted(id) {
    const query = `
      SELECT c.*, u.username as author_username
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = $1
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Get comments for a post
  static async getPostComments(postId, sortBy = 'best', limit = 20, offset = 0) {
    let orderBy;
    
    switch(sortBy) {
      case 'new':
        orderBy = 'c.created_at DESC';
        break;
      case 'old':
        orderBy = 'c.created_at ASC';
        break;
      case 'controversial':
        orderBy = 'ABS(c.upvote_count - c.downvote_count) ASC, c.created_at DESC';
        break;
      case 'top':
        orderBy = 'c.score DESC, c.created_at DESC';
        break;
      case 'best':
      default:
        // Wilson score interval for best comments
        orderBy = `
          CASE 
            WHEN c.upvote_count + c.downvote_count = 0 THEN 0
            ELSE (c.upvote_count + 1.9208) / (c.upvote_count + c.downvote_count) - 
                 1.96 * SQRT((c.upvote_count * c.downvote_count) / (c.upvote_count + c.downvote_count) + 0.9604) / 
                 (c.upvote_count + c.downvote_count)
          END DESC,
          c.created_at DESC
        `;
        break;
    }

    const query = `
      SELECT c.*, 
             u.username as author_username,
             u.avatar_url as author_avatar,
             COALESCE(v.vote_type, 0) as user_vote
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      LEFT JOIN votes v ON c.id = v.comment_id AND v.user_id = $2
      WHERE c.post_id = $1 
        AND c.is_deleted = FALSE
        AND c.parent_comment_id IS NULL
      ORDER BY ${orderBy}
      LIMIT $3 OFFSET $4
    `;
    const result = await pool.query(query, [postId, null, limit, offset]);
    return result.rows;
  }

  // Get top-level comments
  static async getTopLevelComments(postId, limit = 20, offset = 0) {
    const query = `
      SELECT c.*, 
             u.username as author_username,
             u.avatar_url as author_avatar
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1 
        AND c.is_deleted = FALSE
        AND c.parent_comment_id IS NULL
      ORDER BY c.score DESC, c.created_at ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [postId, limit, offset]);
    return result.rows;
  }

  // Get replies to a comment
  static async getCommentReplies(commentId, limit = 20, offset = 0) {
    const query = `
      SELECT c.*, 
             u.username as author_username,
             u.avatar_url as author_avatar
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.parent_comment_id = $1 
        AND c.is_deleted = FALSE
      ORDER BY c.score DESC, c.created_at ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [commentId, limit, offset]);
    return result.rows;
  }

  // Get comments by user
  static async getUserComments(userId, limit = 20, offset = 0) {
    const query = `
      SELECT c.*, 
             u.username as author_username,
             p.title as post_title,
             p.id as post_id,
             comm.name as community_name
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      LEFT JOIN posts p ON c.post_id = p.id
      LEFT JOIN communities comm ON p.community_id = comm.id
      WHERE c.author_id = $1 
        AND c.is_deleted = FALSE
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  // Get comment count for a post
  static async getCommentCount(postId) {
    const query = `
      SELECT COUNT(*) as count
      FROM comments
      WHERE post_id = $1 AND is_deleted = FALSE
    `;
    const result = await pool.query(query, [postId]);
    return parseInt(result.rows[0].count);
  }

  // Update comment
  static async update(id, content, authorId) {
    const query = `
      UPDATE comments 
      SET content = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND author_id = $3 AND is_deleted = FALSE
      RETURNING *
    `;
    const result = await pool.query(query, [id, content, authorId]);
    return result.rows[0];
  }

  // Soft delete comment
  static async delete(id, authorId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Soft delete the comment
      const query = `
        UPDATE comments 
        SET is_deleted = TRUE, 
            content = '[deleted]',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND author_id = $2
        RETURNING *
      `;
      const result = await client.query(query, [id, authorId]);
      
      if (result.rows.length > 0) {
        // Update post comment count
        await client.query(
          'UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1',
          [result.rows[0].post_id]
        );
        
        // Update parent comment reply count
        if (result.rows[0].parent_comment_id) {
          await client.query(
            'UPDATE comments SET reply_count = GREATEST(reply_count - 1, 0) WHERE id = $1',
            [result.rows[0].parent_comment_id]
          );
        }
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

  // Hard delete comment (for moderation)
  static async hardDelete(id) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const query = 'DELETE FROM comments WHERE id = $1 RETURNING *';
      const result = await client.query(query, [id]);
      
      if (result.rows.length > 0) {
        await client.query(
          'UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1',
          [result.rows[0].post_id]
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
}

export default CommentModel;