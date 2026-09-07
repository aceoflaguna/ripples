import express from 'express';
import AuthController from '../controllers/authController.js';
import ValidationMiddleware from '../middleware/validation.js';

const router = express.Router();

// Registration route
router.post(
  '/register',
    (req, res, next) => {
    console.log('POST /register body:', req.body);
    next();
  },
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