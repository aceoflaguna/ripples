import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

class JWTUtils {
  static generateAccessToken(user) {
    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }

  static generateRefreshToken(user) {
    return jwt.sign(
      {
        id: user.id,
        tokenVersion: user.token_version || 0
      },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
  }

  static verifyAccessToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  static verifyRefreshToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return null;
    }
  }

  static decodeToken(token) {
    return jwt.decode(token);
  }
}

export default JWTUtils;