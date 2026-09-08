Perfect! I'll show you the complete implementation with session tracking. Here are all the functions and where to write them:

## 1. Database Schema Addition (add to `database/schema.sql`)

```sql
-- Create user_sessions table
-- CREATE TABLE IF NOT EXISTS user_sessions (
--     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
--     refresh_token TEXT NOT NULL,
--     access_token TEXT,
--     user_agent TEXT,
--     ip_address INET,
--     device_info TEXT,
--     is_active BOOLEAN DEFAULT TRUE,
--     expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
--     last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     revoked_at TIMESTAMP WITH TIME ZONE,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     revocation_reason VARCHAR(50),
--     CONSTRAINT valid_revocation_reason CHECK (
--         revocation_reason IS NULL OR 
--         revocation_reason IN ('logout', 'password_change', 'account_deleted', 'security_concern', 'manual_revocation')
--     )
-- );

-- -- Create indexes for faster lookups
-- CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
-- CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
-- CREATE INDEX idx_user_sessions_access_token ON user_sessions(access_token);
-- CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
-- CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active) WHERE is_active = TRUE;

-- -- Create trigger for updated_at
-- CREATE TRIGGER update_user_sessions_updated_at
--     BEFORE UPDATE ON user_sessions
--     FOR EACH ROW
--     EXECUTE FUNCTION update_updated_at_column();
-- ```

## 2. Session Model (create new file: `src/models/sessionModel.js`)

```javascript
import pool from '../config/database.js';

class SessionModel {
  // Create new session
  static async createSession(userId, refreshToken, accessToken, userAgent, ipAddress, deviceInfo) {
    const query = `
      INSERT INTO user_sessions (
        user_id, refresh_token, access_token, 
        user_agent, ip_address, device_info,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 
        CURRENT_TIMESTAMP + INTERVAL '7 days'
      )
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        userId, 
        refreshToken, 
        accessToken,
        userAgent, 
        ipAddress, 
        deviceInfo
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Create session error:', error);
      throw error;
    }
  }

  // Find session by refresh token
  static async findByRefreshToken(refreshToken) {
    const query = `
      SELECT * FROM user_sessions 
      WHERE refresh_token = $1 
        AND is_active = TRUE 
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
    `;
    const result = await pool.query(query, [refreshToken]);
    return result.rows[0];
  }

  // Find session by access token
  static async findByAccessToken(accessToken) {
    const query = `
      SELECT * FROM user_sessions 
      WHERE access_token = $1 
        AND is_active = TRUE 
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
    `;
    const result = await pool.query(query, [accessToken]);
    return result.rows[0];
  }

  // Update access token for session
  static async updateAccessToken(sessionId, accessToken) {
    const query = `
      UPDATE user_sessions 
      SET access_token = $2, 
          last_used_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [sessionId, accessToken]);
    return result.rows[0];
  }

  // Update last used timestamp
  static async updateLastUsed(sessionId) {
    const query = `
      UPDATE user_sessions 
      SET last_used_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `;
    await pool.query(query, [sessionId]);
  }

  // Revoke session
  static async revokeSession(sessionId, reason = 'logout') {
    const query = `
      UPDATE user_sessions 
      SET is_active = FALSE, 
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = $2
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [sessionId, reason]);
    return result.rows[0];
  }

  // Revoke all sessions for user
  static async revokeAllUserSessions(userId, reason = 'security_concern') {
    const query = `
      UPDATE user_sessions 
      SET is_active = FALSE, 
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = $2
      WHERE user_id = $1 
        AND is_active = TRUE
      RETURNING *
    `;
    const result = await pool.query(query, [userId, reason]);
    return result.rows;
  }

  // Revoke session by token
  static async revokeByRefreshToken(refreshToken, reason = 'logout') {
    const query = `
      UPDATE user_sessions 
      SET is_active = FALSE, 
          revoked_at = CURRENT_TIMESTAMP,
          revocation_reason = $2
      WHERE refresh_token = $1 
        AND is_active = TRUE
      RETURNING *
    `;
    const result = await pool.query(query, [refreshToken, reason]);
    return result.rows[0];
  }

  // Get all active sessions for user
  static async getUserActiveSessions(userId) {
    const query = `
      SELECT id, user_agent, ip_address, device_info, 
             created_at, last_used_at, expires_at
      FROM user_sessions 
      WHERE user_id = $1 
        AND is_active = TRUE 
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_used_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  // Check if session is valid
  static async isValidSession(sessionId) {
    const query = `
      SELECT EXISTS(
        SELECT 1 FROM user_sessions 
        WHERE id = $1 
          AND is_active = TRUE 
          AND revoked_at IS NULL
          AND expires_at > CURRENT_TIMESTAMP
      ) as is_valid
    `;
    const result = await pool.query(query, [sessionId]);
    return result.rows[0].is_valid;
  }
}

export default SessionModel;
```

## 3. Updated JWT Utils (modify `src/utils/jwtUtils.js`)

```javascript
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

class JWTUtils {
  // Generate access token with session ID
  static generateAccessToken(user, sessionId) {
    if (!user || !user.id) {
      throw new Error('Invalid user object for token generation');
    }

    return jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        sessionId: sessionId, // Include session ID in token
        type: 'access'
      },
      process.env.JWT_SECRET,
      { 
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
        algorithm: 'HS256'
      }
    );
  }

  // Generate refresh token with session ID
  static generateRefreshToken(user, sessionId) {
    if (!user || !user.id) {
      throw new Error('Invalid user object for token generation');
    }

    return jwt.sign(
      {
        id: user.id,
        sessionId: sessionId, // Include session ID in token
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

  // Decode token without verification
  static decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      console.error('Token decoding failed:', error.message);
      return null;
    }
  }

  // Extract session ID from token
  static getSessionIdFromToken(token) {
    const decoded = this.decodeToken(token);
    return decoded?.sessionId || null;
  }
}

export default JWTUtils;
```

## 4. Updated Auth Middleware (modify `src/middleware/auth.js`)

```javascript
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
      
      // 1. Verify token signature and expiration
      const decoded = JWTUtils.verifyAccessToken(token);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // 2. Check session in database
      const session = await SessionModel.findByAccessToken(token);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Session not found or has been revoked'
        });
      }

      // 3. Verify session is still active
      if (!session.is_active || session.revoked_at) {
        return res.status(401).json({
          success: false,
          message: 'Session has been revoked'
        });
      }

      // 4. Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        return res.status(401).json({
          success: false,
          message: 'Session has expired'
        });
      }

      // 5. Get user from database
      const user = await UserModel.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      // 6. Check if user is active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated'
        });
      }

      // 7. Update session last used time
      await SessionModel.updateLastUsed(session.id);

      // 8. Add user and session info to request
      req.user = user;
      req.userId = user.id;
      req.sessionId = session.id;
      req.session = session;
      
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
        // Check session
        const session = await SessionModel.findByAccessToken(token);
        
        if (session && session.is_active && !session.revoked_at) {
          const user = await UserModel.findById(decoded.id);
          if (user && user.is_active) {
            req.user = user;
            req.userId = user.id;
            req.sessionId = session.id;
            
            // Update last used
            await SessionModel.updateLastUsed(session.id);
          }
        }
      }
      
      next();
    } catch (error) {
      // Optional auth should not block request
      next();
    }
  }

  // Check if user is session owner
  static async requireSessionOwnership(req, res, next) {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId || sessionId !== req.sessionId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to modify this session'
        });
      }
      
      next();
    } catch (error) {
      console.error('Session ownership check error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify session ownership'
      });
    }
  }
}

export default AuthMiddleware;
```

## 5. Updated Auth Controller (modify `src/controllers/authController.js`)

```javascript
import UserModel from '../models/userModel.js';
import SessionModel from '../models/sessionModel.js';
import PasswordUtils from '../utils/passwordUtils.js';
import JWTUtils from '../utils/jwtUtils.js';

class AuthController {
  // Helper function to get client info
  static getClientInfo(req) {
    return {
      userAgent: req.headers['user-agent'] || 'Unknown',
      ipAddress: req.ip || req.connection.remoteAddress || '0.0.0.0',
      deviceInfo: req.headers['sec-ch-ua'] || req.headers['x-device-info'] || 'Unknown'
    };
  }

  // Register new user
  static async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Check existing user
      const existingEmail = await UserModel.findByEmail(email);
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

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

      // Create session
      const clientInfo = this.getClientInfo(req);
      const session = await SessionModel.createSession(
        user.id,
        '', // Will fill in after token generation
        '', // Will fill in after token generation
        clientInfo.userAgent,
        clientInfo.ipAddress,
        clientInfo.deviceInfo
      );

      // Generate tokens with session ID
      const accessToken = JWTUtils.generateAccessToken(user, session.id);
      const refreshToken = JWTUtils.generateRefreshToken(user, session.id);

      // Update session with tokens
      await SessionModel.updateAccessToken(session.id, accessToken);
      
      // Store refresh token (you might want to hash it before storing)
      const updateRefreshQuery = `
        UPDATE user_sessions 
        SET refresh_token = $2 
        WHERE id = $1
      `;
      await pool.query(updateRefreshQuery, [session.id, refreshToken]);

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
          accessToken,
          refreshToken,
          sessionId: session.id
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during registration'
      });
    }
  }

  // Login user
  static async login(req, res) {
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

      // Create new session
      const clientInfo = this.getClientInfo(req);
      const session = await SessionModel.createSession(
        user.id,
        '', // Will fill in after token generation
        '', // Will fill in after token generation
        clientInfo.userAgent,
        clientInfo.ipAddress,
        clientInfo.deviceInfo
      );

      // Generate tokens with session ID
      const accessToken = JWTUtils.generateAccessToken(user, session.id);
      const refreshToken = JWTUtils.generateRefreshToken(user, session.id);

      // Update session with tokens
      const updateSessionQuery = `
        UPDATE user_sessions 
        SET access_token = $2, refresh_token = $3
        WHERE id = $1
      `;
      await pool.query(updateSessionQuery, [session.id, accessToken, refreshToken]);

      // Update last login
      await UserModel.updateLastLogin(user.id);

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
            karma: user.karma
          },
          accessToken,
          refreshToken,
          sessionId: session.id
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login'
      });
    }
  }

  // Refresh access token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      const decoded = JWTUtils.verifyRefreshToken(refreshToken);
      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired refresh token'
        });
      }

      // Find session by refresh token
      const session = await SessionModel.findByRefreshToken(refreshToken);
      if (!session) {
        return res.status(401).json({
          success: false,
          message: 'Session not found or has been revoked'
        });
      }

      // Verify session belongs to the user in token
      if (session.user_id !== decoded.id) {
        return res.status(401).json({
          success: false,
          message: 'Token does not match session'
        });
      }

      // Get user
      const user = await UserModel.findById(decoded.id);
      if (!user || !user.is_active) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Generate new access token
      const newAccessToken = JWTUtils.generateAccessToken(user, session.id);

      // Update session with new access token
      await SessionModel.updateAccessToken(session.id, newAccessToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken
        }
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to refresh token'
      });
    }
  }

  // Logout user (revoke session)
  static async logout(req, res) {
    try {
      const { refreshToken } = req.body;
      const sessionId = req.sessionId || JWTUtils.getSessionIdFromToken(req.headers.authorization?.split(' ')[1]);

      if (sessionId) {
        // Revoke the specific session
        await SessionModel.revokeSession(sessionId, 'logout');
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

  // Logout from all devices
  static async logoutAll(req, res) {
    try {
      // Revoke all sessions for user
      await SessionModel.revokeAllUserSessions(req.userId, 'manual_revocation');

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to logout from all devices'
      });
    }
  }

  // Get active sessions for current user
  static async getActiveSessions(req, res) {
    try {
      const sessions = await SessionModel.getUserActiveSessions(req.userId);

      res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (error) {
      console.error('Get active sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch active sessions'
      });
    }
  }

  // Revoke specific session
  static async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { reason = 'manual_revocation' } = req.body;

      // Verify session belongs to user
      const session = await SessionModel.findById(sessionId);
      if (!session || session.user_id !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to revoke this session'
        });
      }

      await SessionModel.revokeSession(sessionId, reason);

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully'
      });
    } catch (error) {
      console.error('Revoke session error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to revoke session'
      });
    }
  }
}

export default AuthController;
```

## 6. Updated Auth Routes (modify `src/routes/authRoutes.js`)

```javascript
import express from 'express';
import AuthController from '../controllers/authController.js';
import AuthMiddleware from '../middleware/auth.js';
import ValidationMiddleware from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.post(
  '/register',
  ValidationMiddleware.registerValidation(),
  ValidationMiddleware.validate,
  AuthController.register
);

router.post(
  '/login',
  ValidationMiddleware.loginValidation(),
  ValidationMiddleware.validate,
  AuthController.login
);

router.post(
  '/refresh-token',
  ValidationMiddleware.refreshTokenValidation(),
  ValidationMiddleware.validate,
  AuthController.refreshToken
);

// Protected routes
router.post(
  '/logout',
  AuthMiddleware.authenticate,
  AuthController.logout
);

router.post(
  '/logout-all',
  AuthMiddleware.authenticate,
  AuthController.logoutAll
);

router.get(
  '/me',
  AuthMiddleware.authenticate,
  AuthController.getCurrentUser
);

router.get(
  '/sessions',
  AuthMiddleware.authenticate,
  AuthController.getActiveSessions
);

router.delete(
  '/sessions/:sessionId',
  AuthMiddleware.authenticate,
  AuthController.revokeSession
);

export default router;
```

## 7. Add `findById` method to SessionModel (add to `src/models/sessionModel.js`)

```javascript
// Add this method to SessionModel class
static async findById(sessionId) {
  const query = `
    SELECT * FROM user_sessions 
    WHERE id = $1
  `;
  const result = await pool.query(query, [sessionId]);
  return result.rows[0];
}
```

## 8. Updated REST Client Tests for Session Management

```http
##############################################
# SESSION MANAGEMENT TESTS
##############################################

### Login (Creates Session)
# @name loginWithSession
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

### Store session info
@sessionId = {{loginWithSession.response.body.data.sessionId}}
@accessToken = {{loginWithSession.response.body.data.accessToken}}
@refreshToken = {{loginWithSession.response.body.data.refreshToken}}

### Get Active Sessions
GET {{baseUrl}}/auth/sessions
Authorization: Bearer {{accessToken}}

### Refresh Token (Updates Session)
# @name refreshSession
POST {{baseUrl}}/auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "{{refreshToken}}"
}

### Store new access token
@newAccessToken = {{refreshSession.response.body.data.accessToken}}

### Revoke Specific Session
DELETE {{baseUrl}}/auth/sessions/{{sessionId}}
Authorization: Bearer {{newAccessToken}}
Content-Type: application/json

{
  "reason": "manual_revocation"
}

### Logout (Revokes Current Session)
POST {{baseUrl}}/auth/logout
Authorization: Bearer {{newAccessToken}}
Content-Type: application/json

{
  "refreshToken": "{{refreshToken}}"
}

### Logout All Devices
POST {{baseUrl}}/auth/logout-all
Authorization: Bearer {{newAccessToken}}

### Test Access After Session Revocation (Should Fail)
GET {{baseUrl}}/auth/me
Authorization: Bearer {{newAccessToken}}
```

This complete implementation provides:

1. **Session Tracking**: Every login/register creates a session in the database
2. **Token-Session Link**: JWT tokens contain session IDs
3. **Session Validation**: Middleware checks session status in database
4. **Session Revocation**: Support for logout, logout-all, and manual revocation
5. **Multi-device Support**: Track multiple active sessions per user
6. **Session Management**: View and revoke active sessions
7. **Security Features**: Session expiry, revocation reasons, IP tracking

The flow is now:
1. User logs in → Session created in DB → Tokens generated with session ID
2. Request with token → Middleware verifies JWT → Checks session in DB → Confirms session active
3. Logout → Session marked as revoked in DB
4. Token refresh → New access token linked to same session
5. Logout all → All user sessions revoked