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

router.use(AuthMiddleware.authenticate);
router.post('/logout', AuthController.logout);
router.get('/me', AuthController.getCurrentUser);

// Session management routes
// router.get('/sessions', AuthController.getUserSessions);
// router.delete('/sessions/:sessionId', AuthController.revokeSession);
// router.delete('/sessions', AuthController.revokeAllSessions);

export default router;