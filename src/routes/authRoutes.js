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

router.get(
  '/me',
  AuthMiddleware.authenticate,
  AuthController.getCurrentUser
);

export default router;