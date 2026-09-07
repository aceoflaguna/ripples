import { body, validationResult } from 'express-validator';
import PasswordUtils from '../utils/passwordUtils.js';

class ValidationMiddleware {
  // Validation rules for registration
  static registerValidation() {
    return [
      body('username')
        .isString()
        .withMessage('Username must be a string')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
      
      body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
      
      body('password')
        .isString()
        .withMessage('Password must be a string')
        .custom(value => {
          const validation = PasswordUtils.validatePasswordStrength(value);
          if (!validation.isValid) {
            throw new Error(validation.errors.join(', '));
          }
          return true;
        }),
      
      body('confirmPassword')
        .custom((value, { req }) => {
          if (value !== req.body.password) {
            throw new Error('Password confirmation does not match password');
          }
          return true;
        })
    ];
  }

  // Validation rules for login
  static loginValidation() {
    return [
      body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail(),
      
      body('password')
        .notEmpty()
        .withMessage('Password is required')
    ];
  }

  // Validation rules for refresh token
  static refreshTokenValidation() {
    return [
      body('refreshToken')
        .notEmpty()
        .withMessage('Refresh token is required')
        .isString()
        .withMessage('Refresh token must be a string')
    ];
  }

  // Validation rules for updating profile
  static updateProfileValidation() {
    return [
      body('username')
        .optional()
        .isString()
        .withMessage('Username must be a string')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
      
      body('bio')
        .optional()
        .isString()
        .withMessage('Bio must be a string')
        .isLength({ max: 500 })
        .withMessage('Bio must be 500 characters or less'),
      
      body('avatar_url')
        .optional()
        .isURL()
        .withMessage('Avatar must be a valid URL')
    ];
  }

  // Check validation results
  static validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.param,
          message: err.msg
        }))
      });
    }
    next();
  }
}

export default ValidationMiddleware;