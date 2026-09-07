import SessionModel from '../models/sessionModel.js';
import JWTUtils from './jwtUtils.js';
import crypto from 'crypto';

class SessionUtils {
  // Create a new session with token generation
  static async createSession(user, metadata = {}) {
    try {
      // Generate tokens
      const tokens = JWTUtils.generateTokens(user);
      
      // Create session in database
      const session = await SessionModel.createSession(
        user.id,
        tokens.refreshToken,
        tokens.accessToken,
        metadata
      );
      
      return {
        ...tokens,
        sessionId: session.id
      };
    } catch (error) {
      console.error('Create session error:', error);
      throw new Error('Failed to create session');
    }
  }

  // Validate and refresh session
  static async refreshSession(refreshToken, metadata = {}) {
    try {
      // Verify refresh token
      const decoded = JWTUtils.verifyRefreshToken(refreshToken);
      if (!decoded) {
        throw new Error('Invalid refresh token');
      }

      // Check if session exists and is active
      const session = await SessionModel.findByRefreshToken(refreshToken);
      if (!session) {
        throw new Error('Session not found or expired');
      }

      // Check if session belongs to the token's user
      if (session.user_id !== decoded.id) {
        throw new Error('Session user mismatch');
      }

      // Generate new tokens
      const user = { id: session.user_id };
      const newTokens = JWTUtils.generateTokens(user);

      // Rotate refresh token (revoke old, create new)
      await SessionModel.rotateRefreshToken(
        refreshToken,
        newTokens.refreshToken,
        newTokens.accessToken
      );

      return newTokens;
    } catch (error) {
      console.error('Refresh session error:', error);
      throw error;
    }
  }

  // Revoke session
  static async revokeSession(refreshToken, reason = 'logout') {
    try {
      const session = await SessionModel.revokeByRefreshToken(refreshToken, reason);
      return session;
    } catch (error) {
      console.error('Revoke session error:', error);
      throw error;
    }
  }

  // Revoke all sessions for a user
  static async revokeAllSessions(userId, reason = 'security_concern') {
    try {
      const sessions = await SessionModel.revokeAllUserSessions(userId, reason);
      return sessions;
    } catch (error) {
      console.error('Revoke all sessions error:', error);
      throw error;
    }
  }

  // Extract metadata from request
  static extractRequestMetadata(req) {
    return {
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || req.connection.remoteAddress || null,
      deviceInfo: this.parseDeviceInfo(req.headers['user-agent'])
    };
  }

  // Parse device info from user agent
  static parseDeviceInfo(userAgent) {
    if (!userAgent) return null;
    
    let deviceInfo = {
      browser: null,
      os: null,
      device: null
    };

    // Detect browser
    if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
    else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
    else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
    else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';
    else if (userAgent.includes('Opera')) deviceInfo.browser = 'Opera';
    else deviceInfo.browser = 'Unknown';

    // Detect OS
    if (userAgent.includes('Windows')) deviceInfo.os = 'Windows';
    else if (userAgent.includes('Mac')) deviceInfo.os = 'macOS';
    else if (userAgent.includes('Linux')) deviceInfo.os = 'Linux';
    else if (userAgent.includes('Android')) deviceInfo.os = 'Android';
    else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) deviceInfo.os = 'iOS';
    else deviceInfo.os = 'Unknown';

    // Detect device type
    if (userAgent.includes('Mobile')) deviceInfo.device = 'Mobile';
    else if (userAgent.includes('Tablet')) deviceInfo.device = 'Tablet';
    else deviceInfo.device = 'Desktop';

    return JSON.stringify(deviceInfo);
  }

  // Generate unique device ID
  static generateDeviceId() {
    return crypto.randomBytes(16).toString('hex');
  }
}

export default SessionUtils;