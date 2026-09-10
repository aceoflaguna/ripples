import UserModel from '../models/userModel.js';
import PasswordUtils from '../utils/passwordUtils.js';
import SessionUtils from '../utils/sessionUtils.js';
import SessionModel from '../models/sessionModel.js';

class AuthController {
  // Register new user
  static async register(req, res, next) {
    try {
      const { username, email, password } = req.body;

      // Check if user already exists
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Check if username is taken
      const existingUsername = await UserModel.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({
          success: false,
          message: 'Username already taken'
        });
      }

      // Hash password
      const passwordHash = await PasswordUtils.hashPassword(password);

      // Create user
      const user = await UserModel.createUser(username, email, passwordHash);

      // Extract request metadata
      const metadata = SessionUtils.extractRequestMetadata(req);

      // Create session with tokens
      const sessionData = await SessionUtils.createSession(user, metadata);

      // Update last login
      await UserModel.updateLastLogin(user.id);

      // Return success response with tokens
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at
          },
          ...sessionData
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Login user
  static async login(req, res, next) {
    try {
      const { email, password } = req.body;

      // Find user
      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Verify password
      const isValidPassword = await PasswordUtils.verifyPassword(user.password_hash, password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Check if password needs rehash
      const needsRehash = await PasswordUtils.needsRehash(user.password_hash);
      if (needsRehash) {
        const newHash = await PasswordUtils.hashPassword(password);
        await UserModel.updatePassword(user.id, newHash);
      }

      // Extract request metadata
      const metadata = SessionUtils.extractRequestMetadata(req);

      // Create session with tokens
      const sessionData = await SessionUtils.createSession(user, metadata);

      // Update last login
      await UserModel.updateLastLogin(user.id);

      // Return success response with tokens
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
            bio: user.bio,
            karma: user.karma,
            created_at: user.created_at
          },
          ...sessionData
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Refresh access token
  static async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Extract request metadata
      const metadata = SessionUtils.extractRequestMetadata(req);

      // Refresh session with token rotation
      const tokens = await SessionUtils.refreshSession(refreshToken, metadata);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: tokens
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      
      if (error.message === 'Invalid refresh token') {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }
      
      if (error.message === 'Session not found or expired') {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token'
      });
    }
  }

  // Logout user
  static async logout(req, res, next) {
    try {
      const { refreshToken } = req.body || {};
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.split(' ')[1];
        
        // Find and revoke session by access token
        const session = await SessionModel.findByAccessToken(accessToken);
        if (session) {
          await SessionModel.revokeSession(session.id, 'logout');
        }
      } else if (refreshToken) {
        // Revoke by refresh token
        await SessionModel.revokeByRefreshToken(refreshToken, 'logout');
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to logout'
      });
    }
  }

  // Get current user sessions
  // static async getUserSessions(req, res) {
  //   try {
  //     const sessions = await SessionModel.getUserSessions(req.userId);
      
  //     res.status(200).json({
  //       success: true,
  //       data: sessions
  //     });
  //   } catch (error) {
  //     console.error('Get user sessions error:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to fetch sessions'
  //     });
  //   }
  // }

  // Revoke specific session
  // static async revokeSession(req, res) {
  //   try {
  //     const { sessionId } = req.params;
      
  //     const session = await SessionModel.revokeSession(sessionId, 'manual_revocation');
      
  //     if (!session) {
  //       return res.status(404).json({
  //         success: false,
  //         message: 'Session not found'
  //       });
  //     }

  //     res.status(200).json({
  //       success: true,
  //       message: 'Session revoked successfully'
  //     });
  //   } catch (error) {
  //     console.error('Revoke session error:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to revoke session'
  //     });
  //   }
  // }

  // Revoke all sessions
  // static async revokeAllSessions(req, res) {
  //   try {
  //     const { reason = 'security_concern' } = req.body;
      
  //     await SessionModel.revokeAllUserSessions(req.userId, reason);

  //     res.status(200).json({
  //       success: true,
  //       message: 'All sessions revoked successfully'
  //     });
  //   } catch (error) {
  //     console.error('Revoke all sessions error:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: 'Failed to revoke sessions'
  //     });
  //   }
  // }

  // Get current user
  static async getCurrentUser(req, res, next) {
    try {
      const user = await UserModel.findById(req.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

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
}

export default AuthController;