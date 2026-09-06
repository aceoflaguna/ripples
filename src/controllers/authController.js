import UserModel from '../models/userModel.js';
import PasswordUtils from '../utils/passwordUtils.js';

class AuthController {
  // Register new user
  static async register(req, res, next) {
    try {
      const { email, password } = req.body;

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
      }

      // Hash password
      const passwordHash = await PasswordUtils.hashPassword(password);

      // Create user
      const user = await UserModel.createUser(email, passwordHash);

      // Return success response (exclude sensitive data)
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          id: user.id,
          email: user.email,
          createdAt: user.created_at
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
        // Rehash password with current parameters
        const newHash = await PasswordUtils.hashPassword(password);
        await UserModel.updatePassword(user.id, newHash);
      }

      // Update last login
      await UserModel.updateLastLogin(user.id);

      // Return success response
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          id: user.id,
          email: user.email,
          lastLogin: new Date()
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
}

export default AuthController;