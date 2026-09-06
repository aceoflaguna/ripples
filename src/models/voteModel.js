import pool from '../config/database.js';

class VoteModel {
  static async vote(userId, postId, commentId, voteType) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Upsert vote
      const voteQuery = `
        INSERT INTO votes (user_id, post_id, comment_id, vote_type)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, post_id, comment_id)
        DO UPDATE SET vote_type = $4
        RETURNING *
      `;
      const voteResult = await client.query(voteQuery, [userId, postId, commentId, voteType]);
      const vote = voteResult.rows[0];
      
      // Update post or comment vote counts
      if (postId) {
        await client.query(`
          UPDATE posts 
          SET 
            upvote_count = (SELECT COUNT(*) FROM votes WHERE post_id = $1 AND vote_type = 1),
            downvote_count = (SELECT COUNT(*) FROM votes WHERE post_id = $1 AND vote_type = -1),
            score = upvote_count - downvote_count
          WHERE id = $1
        `, [postId]);
      } else if (commentId) {
        await client.query(`
          UPDATE comments 
          SET 
            upvote_count = (SELECT COUNT(*) FROM votes WHERE comment_id = $1 AND vote_type = 1),
            downvote_count = (SELECT COUNT(*) FROM votes WHERE comment_id = $1 AND vote_type = -1),
            score = upvote_count - downvote_count
          WHERE id = $1
        `, [commentId]);
      }
      
      await client.query('COMMIT');
      return vote;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async removeVote(userId, postId, commentId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const query = `
        DELETE FROM votes 
        WHERE user_id = $1 AND post_id = $2 AND comment_id = $3
        RETURNING *
      `;
      const result = await client.query(query, [userId, postId, commentId]);
      
      if (result.rows.length > 0) {
        // Update vote counts
        if (postId) {
          await client.query(`
            UPDATE posts 
            SET 
              upvote_count = (SELECT COUNT(*) FROM votes WHERE post_id = $1 AND vote_type = 1),
              downvote_count = (SELECT COUNT(*) FROM votes WHERE post_id = $1 AND vote_type = -1),
              score = upvote_count - downvote_count
            WHERE id = $1
          `, [postId]);
        } else if (commentId) {
          await client.query(`
            UPDATE comments 
            SET 
              upvote_count = (SELECT COUNT(*) FROM votes WHERE comment_id = $1 AND vote_type = 1),
              downvote_count = (SELECT COUNT(*) FROM votes WHERE comment_id = $1 AND vote_type = -1),
              score = upvote_count - downvote_count
            WHERE id = $1
          `, [commentId]);
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

  static async getUserVote(userId, postId, commentId) {
    const query = `
      SELECT vote_type FROM votes 
      WHERE user_id = $1 AND post_id = $2 AND comment_id = $3
    `;
    const result = await pool.query(query, [userId, postId, commentId]);
    return result.rows[0]?.vote_type || 0;
  }
}

export default VoteModel;