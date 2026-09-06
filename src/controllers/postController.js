import PostModel from '../models/postModel.js';
import CommunityModel from '../models/communityModel.js';

class PostController {
  static async create(req, res) {
    try {
      const { communityId, title, content, type = 'text', url } = req.body;
      
      // Validate community
      const community = await CommunityModel.findById(communityId);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: 'Community not found'
        });
      }
      
      // Check if user is a member
      const memberRole = await CommunityModel.getMemberRole(communityId, req.userId);
      if (!memberRole) {
        return res.status(403).json({
          success: false,
          message: 'You must be a member to post in this community'
        });
      }
      
      // Validate URL for link posts
      if (type === 'link' && !url) {
        return res.status(400).json({
          success: false,
          message: 'URL is required for link posts'
        });
      }
      
      const post = await PostModel.create(req.userId, communityId, title, content, type, url);
      
      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: post
      });
    } catch (error) {
      console.error('Create post error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create post'
      });
    }
  }

  static async getFeed(req, res) {
    try {
      const { sortBy = 'hot', limit = 20, offset = 0 } = req.query;
      const userId = req.userId || null;
      
      const posts = await PostModel.getFeed(userId, sortBy, parseInt(limit), parseInt(offset));
      
      res.status(200).json({
        success: true,
        data: posts,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('Get feed error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch feed'
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.userId || null;
      
      const post = await PostModel.findById(id, userId);
      
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Get post error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch post'
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { title, content, url } = req.body;
      
      const post = await PostModel.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }
      
      if (post.author_id !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only edit your own posts'
        });
      }
      
      const updatedPost = await PostModel.update(id, { title, content, url });
      
      res.status(200).json({
        success: true,
        message: 'Post updated successfully',
        data: updatedPost
      });
    } catch (error) {
      console.error('Update post error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update post'
      });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      const post = await PostModel.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }
      
      if (post.author_id !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own posts'
        });
      }
      
      await PostModel.delete(id, req.userId);
      
      res.status(200).json({
        success: true,
        message: 'Post deleted successfully'
      });
    } catch (error) {
      console.error('Delete post error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete post'
      });
    }
  }

  static async search(req, res) {
    try {
      const { q, limit = 20, offset = 0 } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }
      
      const posts = await PostModel.searchPosts(q, parseInt(limit), parseInt(offset));
      
      res.status(200).json({
        success: true,
        data: posts
      });
    } catch (error) {
      console.error('Search posts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search posts'
      });
    }
  }
}

export default PostController;