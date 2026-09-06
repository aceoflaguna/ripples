import { body, validationResult } from 'express-validator';
import PasswordUtils from '../utils/passwordUtils.js';

class ValidationMiddleware {
  // Validation rules for registration
  static registerValidation() {
    return [
      body('email')
        .isEmail()
        .withMessage('Please provide a valid email address')
        .normalizeEmail()
        .custom(value => {
          if (!value) return false;
          return true;
        }),
      
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