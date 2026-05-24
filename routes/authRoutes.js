const express = require('express')
const router  = express.Router()
const rateLimit = require('express-rate-limit')
const { body, param } = require('express-validator')

const {
  register, login, getMe, updateMe, changePassword, forgotPassword, resetPassword, logout, googleAuth,
} = require('../controllers/authController')
const { requestOtp, loginWithOtp } = require('../controllers/otpController')
const { protect }  = require('../middleware/auth')
const validate     = require('../middleware/validate')

// ── Validation rules ───────────────────────────────────────
const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['patient', 'doctor']).withMessage('Role must be patient or doctor'),
]

const loginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
]

const otpSendRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('purpose').isIn(['login', 'register']).withMessage('purpose must be login or register'),
]

const otpLoginRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('code').trim().isLength({ min: 6, max: 8 }).withMessage('Valid code is required'),
]

const googleRules = [
  body('idToken').trim().notEmpty().withMessage('Google idToken is required'),
]

const forgotPasswordRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
]

const resetPasswordRules = [
  param('token').trim().isLength({ min: 64, max: 128 }).withMessage('Reset token is invalid'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[a-z]/).withMessage('Password must include a lowercase letter')
    .matches(/[A-Z]/).withMessage('Password must include an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must include a number'),
  body('confirmPassword')
    .optional()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match'),
]

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 50 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset requests. Please try again later.' },
})

const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 60 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification code requests. Please try again later.' },
})

// ── Routes ────────────────────────────────────────────────
// Public
router.post('/otp/send',  otpSendLimiter, otpSendRules,  validate, requestOtp)
router.post('/otp/login', otpLoginRules, validate, loginWithOtp)
router.post('/google',    googleRules,   validate, googleAuth)
router.post('/register', registerRules, validate, register)
router.post('/login',    loginRules,    validate, login)
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordRules, validate, forgotPassword)
router.put('/reset-password/:token', resetPasswordRules, validate, resetPassword)

// Protected
router.use(protect)
router.get('/me',              getMe)
router.put('/me',              updateMe)
router.put('/change-password', changePassword)
router.post('/logout',         logout)
router.post('/refresh',        (req, res) => {
  const token = req.user.generateToken()
  res.json({ success: true, message: 'Token refreshed', data: { token } })
})

module.exports = router
