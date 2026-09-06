import express from 'express';
import AuthController from '../controllers/authController.js';
import ValidationMiddleware from '../middleware/validation.js';

const router = express.Router();

// Registration route
router.post(
  '/register',
  ValidationMiddleware.registerValidation(),
  ValidationMiddleware.validate,
  AuthController.register
);

// Login route
router.post(
  '/login',
  ValidationMiddleware.loginValidation(),
  ValidationMiddleware.validate,
  AuthController.login
);

export default router;