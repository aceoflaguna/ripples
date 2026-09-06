import JWTUtils from '../utils/jwtUtils.js';
import UserModel from '../models/userModel.js';

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

      req.user = user;
      req.userId = user.id;
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
        const user = await UserModel.findById(decoded.id);
        if (user && user.is_active) {
          req.user = user;
          req.userId = user.id;
        }
      }
      
      next();
    } catch (error) {
      next();
    }
  }

  static authorizeRoles(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions'
        });
      }

      next();
    };
  }
}

export default AuthMiddleware;