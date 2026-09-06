import pool from '../config/database.js';

class CommentModel {
  static async create(content, authorId, postId, parentCommentId = null) {
    const query = `
      INSERT INTO comments (content, author_id, post_id, parent_comment_id, depth)
      VALUES ($1, $2, $3, $4, 
        CASE 
          WHEN $4 IS NULL THEN 0 
          ELSE (SELECT depth + 1 FROM comments WHERE id = $4)
        END
      )
      RETURNING *
    `;
    const result = await pool.query(query, [content, authorId, postId, parentCommentId]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT c.*, u.username as author_username
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.id = $1 AND c.is_deleted = FALSE
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

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
        orderBy = 'ABS(c.upvote_count - c.downvote_count) ASC';
        break;
      case 'top':
        orderBy = 'c.score DESC';
        break;
      case 'best':
      default:
        orderBy = '(c.score * 100) / EXTRACT(EPOCH FROM (NOW() - c.created_at)) DESC';
        break;
    }

    const query = `
      SELECT c.*, u.username as author_username
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1 AND c.is_deleted = FALSE
      ORDER BY ${orderBy}
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [postId, limit, offset]);
    return result.rows;
  }

  static async getCommentReplies(commentId, limit = 20, offset = 0) {
    const query = `
      SELECT c.*, u.username as author_username
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.parent_comment_id = $1 AND c.is_deleted = FALSE
      ORDER BY c.score DESC, c.created_at ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [commentId, limit, offset]);
    return result.rows;
  }

  static async getUserComments(userId, limit = 20, offset = 0) {
    const query = `
      SELECT c.*, u.username as author_username
      FROM comments c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE c.author_id = $1 AND c.is_deleted = FALSE
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  }

  static async update(id, content, authorId) {
    const query = `
      UPDATE comments 
      SET content = $2
      WHERE id = $1 AND author_id = $3 AND is_deleted = FALSE
      RETURNING *
    `;
    const result = await pool.query(query, [id, content, authorId]);
    return result.rows[0];
  }

  static async delete(id, authorId) {
    const query = `
      UPDATE comments 
      SET is_deleted = TRUE, content = '[deleted]'
      WHERE id = $1 AND author_id = $2
      RETURNING *
    `;
    const result = await pool.query(query, [id, authorId]);
    return result.rows[0];
  }
}

export default CommentModel;