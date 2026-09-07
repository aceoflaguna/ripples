import JWTUtils from '../utils/jwtUtils.js';
import UserModel from '../models/userModel.js';
import SessionModel from '../models/sessionModel.js';

class AuthMiddleware {
  static async authenticate(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const token = authHeader.split(' ')[1];
      const decoded = JWTUtils.verifyAccessToken(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // Check if session exists and is active
      const session = await SessionModel.findByAccessToken(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Session not found or expired'
        });
      }

      const user = await UserModel.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // Update session last used
      await SessionModel.updateLastUsed(session.id);

      req.user = user;
      req.userId = user.id;
      req.sessionId = session.id;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }

  static async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      const token = authHeader.split(' ')[1];
      const decoded = JWTUtils.verifyAccessToken(token);

      if (decoded) {
        const session = await SessionModel.findByAccessToken(token);
        if (session) {
          const user = await UserModel.findById(decoded.id);
          if (user && user.is_active) {
            req.user = user;
            req.userId = user.id;
            req.sessionId = session.id;
            
            // Update session last used
            await SessionModel.updateLastUsed(session.id);
          }
        }
      }
      
      next();
    } catch (error) {
      next();
    }
  }
}

export default AuthMiddleware;