import CommunityModel from '../models/communityModel.js';
import PostModel from '../models/postModel.js';

class CommunityController {
  static async create(req, res) {
    try {
      const { name, description } = req.body;
      
      // Validate community name
      if (!/^[a-zA-Z0-9_]+$/.test(name)) {
        return res.status(400).json({
          success: false,
          message: 'Community name can only contain letters, numbers, and underscores'
        });
      }
      
      // Check if community already exists
      const existingCommunity = await CommunityModel.findByName(name);
      if (existingCommunity) {
        return res.status(409).json({
          success: false,
          message: 'Community already exists'
        });
      }
      
      const community = await CommunityModel.create(name, description, req.userId);
      
      res.status(201).json({
        success: true,
        message: 'Community created successfully',
        data: community
      });
    } catch (error) {
      console.error('Create community error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create community'
      });
    }
  }

  static async getAll(req, res) {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const communities = await CommunityModel.getAll(parseInt(limit), parseInt(offset));
      
      res.status(200).json({
        success: true,
        data: communities
      });
    } catch (error) {
      console.error('Get communities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch communities'
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const community = await CommunityModel.findById(id);
      
      if (!community) {
        return res.status(404).json({
          success: false,
          message: 'Community not found'
        });
      }
      
      res.status(200).json({
        success: true,
        data: community
      });
    } catch (error) {
      console.error('Get community error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch community'
      });
    }
  }

  static async join(req, res) {
    try {
      const { id } = req.params;
      
      const community = await CommunityModel.findById(id);
      if (!community) {
        return res.status(404).json({
          success: false,
          message: 'Community not found'
        });
      }
      
      await CommunityModel.joinCommunity(id, req.userId);
      
      res.status(200).json({
        success: true,
        message: 'Joined community successfully'
      });
    } catch (error) {
      console.error('Join community error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to join community'
      });
    }
  }

  static async leave(req, res) {
    try {
      const { id } = req.params;
      
      await CommunityModel.leaveCommunity(id, req.userId);
      
      res.status(200).json({
        success: true,
        message: 'Left community successfully'
      });
    } catch (error) {
      console.error('Leave community error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to leave community'
      });
    }
  }

  static async search(req, res) {
    try {
      const { q, limit = 20 } = req.query;
      
      if (!q) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }
      
      const communities = await CommunityModel.searchCommunities(q, parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: communities
      });
    } catch (error) {
      console.error('Search communities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search communities'
      });
    }
  }
}

export default CommunityController;