import VoteModel from '../models/voteModel.js';
import PostModel from '../models/postModel.js';
import CommentModel from '../models/commentModel.js';

class VoteController {
  static async vote(req, res) {
    try {
      const { postId, commentId, voteType } = req.body;
      
      // Validate input
      if (!postId && !commentId) {
        return res.status(400).json({
          success: false,
          message: 'Either postId or commentId is required'
        });
      }
      
      if (postId && commentId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot vote on both post and comment'
        });
      }
      
      if (![1, -1].includes(voteType)) {
        return res.status(400).json({
          success: false,
          message: 'Vote type must be 1 (upvote) or -1 (downvote)'
        });
      }
      
      // Verify target exists
      if (postId) {
        const post = await PostModel.findById(postId);
        if (!post) {
          return res.status(404).json({
            success: false,
            message: 'Post not found'
          });
        }
      } else if (commentId) {
        const comment = await CommentModel.findById(commentId);
        if (!comment) {
          return res.status(404).json({
            success: false,
            message: 'Comment not found'
          });
        }
      }
      
      const vote = await VoteModel.vote(req.userId, postId, commentId, voteType);
      
      res.status(200).json({
        success: true,
        message: 'Vote recorded successfully',
        data: vote
      });
    } catch (error) {
      console.error('Vote error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record vote'
      });
    }
  }

  static async removeVote(req, res) {
    try {
      const { postId, commentId } = req.body;
      
      if (!postId && !commentId) {
        return res.status(400).json({
          success: false,
          message: 'Either postId or commentId is required'
        });
      }
      
      await VoteModel.removeVote(req.userId, postId, commentId);
      
      res.status(200).json({
        success: true,
        message: 'Vote removed successfully'
      });
    } catch (error) {
      console.error('Remove vote error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove vote'
      });
    }
  }
}

export default VoteController;