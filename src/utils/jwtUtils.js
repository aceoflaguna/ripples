import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

class JWTUtils {
  // Generate access token (short-lived)
  static generateAccessToken(user) {
    if (!user || !user.id) {
      throw new Error('Invalid user object for token generation');
    }

    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        type: 'access'
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        algorithm: 'HS256'
      }
    );
  }

  // Generate refresh token (long-lived)
  static generateRefreshToken(user) {
    if (!user || !user.id) {
      throw new Error('Invalid user object for token generation');
    }

    return jwt.sign(
      {
        id: user.id,
        type: 'refresh',
        tokenVersion: user.token_version || 0
      },
      process.env.JWT_REFRESH_SECRET,
      { 
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        algorithm: 'HS256'
      }
    );
  }

  // Generate both tokens
  static generateTokens(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    };
  }

  // Verify access token
  static verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.type !== 'access') {
        return null;
      }
      return decoded;
    } catch (error) {
      console.error('Access token verification failed:', error.message);
      return null;
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
      if (decoded.type !== 'refresh') {
        return null;
      }
      return decoded;
    } catch (error) {
      console.error('Refresh token verification failed:', error.message);
      return null;
    }
  }

  // Decode token without verification (for debugging)
  static decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      console.error('Token decoding failed:', error.message);
      return null;
    }
  }

  // Check if token is expired
  static isTokenExpired(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return true;
    }
    
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp < now;
  }

  // Get token expiration time
  static getTokenExpiration(token) {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }
}

export default JWTUtils;