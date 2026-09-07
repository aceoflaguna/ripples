import UserModel from '../models/userModel.js';
import PostModel from '../models/postModel.js';
import CommentModel from '../models/commentModel.js';
import CommunityModel from '../models/communityModel.js';

class UserController {
  // Get current user profile
  static async getCurrentUser(req, res) {
    try {
      const user = await UserModel.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get user stats
      const stats = await UserModel.getUserStats(req.userId);

      res.status(200).json({
        success: true,
        data: {
          ...user,
          stats
        }
      });
    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile'
      });
    }
  }

  // Get user profile by username
  static async getUserByUsername(req, res) {
    try {
      const { username } = req.params;
      
      const user = await UserModel.findByUsername(username);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Remove sensitive data
      const { password_hash, ...safeUser } = user;

      // Get user stats
      const stats = await UserModel.getUserStats(user.id);

      // Check if the requesting user is following (if implemented)
      let isFollowing = false;
      if (req.userId && req.userId !== user.id) {
        isFollowing = await UserModel.isFollowing(req.userId, user.id);
      }

      res.status(200).json({
        success: true,
        data: {
          ...safeUser,
          stats,
          isFollowing
        }
      });
    } catch (error) {
      console.error('Get user by username error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile'
      });
    }
  }

  // Update user profile
  static async updateProfile(req, res) {
    try {
      const { username, avatar_url, bio } = req.body;

      // Check if username is being changed and validate
      if (username) {
        // Validate username format
        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
          return res.status(400).json({
            success: false,
            message: 'Username must be 3-20 characters and can only contain letters, numbers, and underscores'
          });
        }

        // Check if username is taken
        const existingUser = await UserModel.findByUsername(username);
        if (existingUser && existingUser.id !== req.userId) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken'
          });
        }
      }

      // Validate bio length
      if (bio && bio.length > 500) {
        return res.status(400).json({
          success: false,
          message: 'Bio must be 500 characters or less'
        });
      }

      // Validate avatar URL
      if (avatar_url && !isValidUrl(avatar_url)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid avatar URL'
        });
      }

      const updatedUser = await UserModel.updateProfile(req.userId, {
        username,
        avatar_url,
        bio
      });

      if (!updatedUser) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile'
      });
    }
  }

  // Get user stats
  static async getUserStats(req, res) {
    try {
      const { username } = req.params;
      
      const user = await UserModel.findByUsername(username);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const stats = await UserModel.getUserStats(user.id);

      res.status(200).json({
        success: true,
        data: {
          ...stats,
          karma: user.karma,
          cake_day: user.cake_day
        }
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user stats'
      });
    }
  }

  // Get user posts
  static async getUserPosts(req, res) {
    try {
      const { username } = req.params;
      const { sortBy = 'new', limit = 20, offset = 0 } = req.query;

      // Validate sort option
      const validSortOptions = ['new', 'top', 'hot', 'controversial'];
      if (!validSortOptions.includes(sortBy)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sort option. Must be one of: ' + validSortOptions.join(', ')
        });
      }

      const user = await UserModel.findByUsername(username);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const posts = await PostModel.getUserPosts(
        user.id,
        sortBy,
        parseInt(limit),
        parseInt(offset)
      );

      const totalCount = await PostModel.getUserPostCount(user.id);

      res.status(200).json({
        success: true,
        data: posts,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: totalCount,
          hasMore: parseInt(offset) + posts.length < totalCount
        }
      });
    } catch (error) {
      console.error('Get user posts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user posts'
      });
    }
  }

  // Get user comments
  static async getUserComments(req, res) {
    try {
      const { username } = req.params;
      const { sortBy = 'new', limit = 20, offset = 0 } = req.query;

      // Validate sort option
      const validSortOptions = ['new', 'top', 'controversial'];
      if (!validSortOptions.includes(sortBy)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid sort option. Must be one of: ' + validSortOptions.join(', ')
        });
      }

      const user = await UserModel.findByUsername(username);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const comments = await CommentModel.getUserComments(
        user.id,
        sortBy,
        parseInt(limit),
        parseInt(offset)
      );

      const totalCount = await CommentModel.getUserCommentCount(user.id);

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
      console.error('Get user comments error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user comments'
      });
    }
  }

  // Get user communities
  static async getUserCommunities(req, res) {
    try {
      const { username } = req.params;
      const { limit = 20, offset = 0 } = req.query;

      const user = await UserModel.findByUsername(username);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const communities = await CommunityModel.getUserCommunities(
        user.id,
        parseInt(limit),
        parseInt(offset)
      );

      res.status(200).json({
        success: true,
        data: communities,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: communities.length === parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Get user communities error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user communities'
      });
    }
  }

  // Follow user (optional feature)
  static async followUser(req, res) {
    try {
      const { username } = req.params;
      
      const userToFollow = await UserModel.findByUsername(username);
      
      if (!userToFollow) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      if (userToFollow.id === req.userId) {
        return res.status(400).json({
          success: false,
          message: 'You cannot follow yourself'
        });
      }

      await UserModel.followUser(req.userId, userToFollow.id);

      res.status(200).json({
        success: true,
        message: `You are now following u/${username}`
      });
    } catch (error) {
      console.error('Follow user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to follow user'
      });
    }
  }

  // Unfollow user (optional feature)
  static async unfollowUser(req, res) {
    try {
      const { username } = req.params;
      
      const userToUnfollow = await UserModel.findByUsername(username);
      
      if (!userToUnfollow) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await UserModel.unfollowUser(req.userId, userToUnfollow.id);

      res.status(200).json({
        success: true,
        message: `You have unfollowed u/${username}`
      });
    } catch (error) {
      console.error('Unfollow user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to unfollow user'
      });
    }
  }

  // Delete user account
  static async deleteAccount(req, res) {
    try {
      const { confirmation } = req.body;

      if (confirmation !== 'DELETE') {
        return res.status(400).json({
          success: false,
          message: 'Please type DELETE to confirm account deletion'
        });
      }

      await UserModel.deleteUser(req.userId);

      res.status(200).json({
        success: true,
        message: 'Account deleted successfully'
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete account'
      });
    }
  }
}

// Helper function to validate URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export default UserController;