import CommentModel from '../models/commentModel.js';
import PostModel from '../models/postModel.js';
import UserModel from '../models/userModel.js';
import CommunityModel from '../models/communityModel.js'; // Add this import


class CommentController {
  // Create a new comment or reply
  static async create(req, res) {
    try {
      const { postId, parentCommentId, content } = req.body;

      // Validate required fields
      if (!postId || !content) {
        return res.status(400).json({
          success: false,
          message: 'Post ID and content are required'
        });
      }

      // Check if post exists
      const post = await PostModel.findById(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      // Check if post is locked
      if (post.is_locked) {
        return res.status(403).json({
          success: false,
          message: 'This post is locked and cannot receive new comments'
        });
      }

      // If it's a reply, check if parent comment exists
      if (parentCommentId) {
        const parentComment = await CommentModel.findById(parentCommentId);
        if (!parentComment) {
          return res.status(404).json({
            success: false,
            message: 'Parent comment not found'
          });
        }

        // Ensure parent comment belongs to the same post
        if (parentComment.post_id !== postId) {
          return res.status(400).json({
            success: false,
            message: 'Parent comment does not belong to this post'
          });
        }

        // Limit nesting depth (prevent infinite nesting)
        if (parentComment.depth >= 10) {
          return res.status(400).json({
            success: false,
            message: 'Maximum comment depth reached'
          });
        }
      }

      // Create the comment
      const comment = await CommentModel.create(
        content,
        req.userId,
        postId,
        parentCommentId
      );

      // Return created comment with author info
      const fullComment = await CommentModel.findById(comment.id);

      res.status(201).json({
        success: true,
        message: parentCommentId ? 'Reply added successfully' : 'Comment added successfully',
        data: fullComment
      });
    } catch (error) {
      console.error('Create comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create comment'
      });
    }
  }

  // Get comments for a post
  static async getPostComments(req, res) {
    try {
      const { postId } = req.params;
      const { sortBy = 'best', limit = 20, offset = 0 } = req.query;

      // Validate sort option
      const validSortOptions = ['best', 'top', 'new', 'old', 'controversial'];
      if (!validSortOptions.includes(sortBy)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sort option. Must be one of: ' + validSortOptions.join(', ')
        });
      }

      // Check if post exists
      const post = await PostModel.findById(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      // Get comments
      const comments = await CommentModel.getPostComments(
        postId,
        sortBy,
        parseInt(limit),
        parseInt(offset)
      );

      // Get total count for pagination
      const totalCount = await CommentModel.getCommentCount(postId);

      res.status(200).json({
        success: true,
        data: comments,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          hasMore: parseInt(offset) + comments.length < totalCount
        }
      });
    } catch (error) {
      console.error('Get post comments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comments'
      });
    }
  }

  // Get replies to a comment
  static async getReplies(req, res) {
    try {
      const { id } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      // Check if parent comment exists
      const parentComment = await CommentModel.findById(id);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found'
        });
      }

      // Get replies
      const replies = await CommentModel.getCommentReplies(
        id,
        parseInt(limit),
        parseInt(offset)
      );

      res.status(200).json({
        success: true,
        data: replies,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: replies.length === parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get replies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch replies'
      });
    }
  }

  // Get a single comment by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const comment = await CommentModel.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found'
        });
      }

      res.status(200).json({
        success: true,
        data: comment
      });
    } catch (error) {
      console.error('Get comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comment'
      });
    }
  }

  // Update a comment
  static async update(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;

      // Validate content
      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Comment content cannot be empty'
        });
      }

      // Check if comment exists
      const existingComment = await CommentModel.findById(id);
      if (!existingComment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found'
        });
      }

      // Check if user is the author
      if (existingComment.author_id !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit your own comments'
        });
      }

      // Check if comment is deleted
      if (existingComment.is_deleted) {
        return res.status(400).json({
          success: false,
          message: 'Cannot edit a deleted comment'
        });
      }

      // Update the comment
      const updatedComment = await CommentModel.update(id, content, req.userId);

      res.status(200).json({
        success: true,
        message: 'Comment updated successfully',
        data: updatedComment
      });
    } catch (error) {
      console.error('Update comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update comment'
      });
    }
  }

  // Delete a comment
  static async delete(req, res) {
    try {
      const { id } = req.params;

      // Check if comment exists
      const existingComment = await CommentModel.findById(id);
      if (!existingComment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found'
        });
      }

      // Check if user is the author
      if (existingComment.author_id !== req.userId) {
        // Check if user is a moderator of the community
        const post = await PostModel.findById(existingComment.post_id);
        if (post) {
          const userRole = await CommunityModel.getMemberRole(post.community_id, req.userId);
          if (!['admin', 'moderator'].includes(userRole)) {
            return res.status(403).json({
              success: false,
              message: 'You can only delete your own comments'
            });
          }
        } else {
          return res.status(403).json({
            success: false,
            message: 'You can only delete your own comments'
          });
        }
      }

      // Delete the comment
      await CommentModel.delete(id, existingComment.author_id);

      res.status(200).json({
        success: true,
        message: 'Comment deleted successfully'
      });
    } catch (error) {
      console.error('Delete comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete comment'
      });
    }
  }

  // Get comments by user
  static async getUserComments(req, res) {
    try {
      const { username } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      // Find user by username
      const user = await UserModel.findByUsername(username);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user's comments
      const comments = await CommentModel.getUserComments(
        user.id,
        parseInt(limit),
        parseInt(offset)
      );

      res.status(200).json({
        success: true,
        data: comments,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: comments.length === parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get user comments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user comments'
      });
    }
  }

  // Get comment tree (for threaded view)
  static async getCommentTree(req, res) {
    try {
      const { postId } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      // Check if post exists
      const post = await PostModel.findById(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      // Get top-level comments
      const topLevelComments = await CommentModel.getTopLevelComments(
        postId,
        parseInt(limit),
        parseInt(offset)
      );

      // Build comment tree
      const commentTree = await Promise.all(
        topLevelComments.map(async (comment) => {
          const replies = await CommentModel.getCommentReplies(comment.id, 10, 0);
          return {
            ...comment,
            replies
          };
        })
      );

      res.status(200).json({
        success: true,
        data: commentTree,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: topLevelComments.length === parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get comment tree error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch comment tree'
      });
    }
  }
}

export default CommentController;