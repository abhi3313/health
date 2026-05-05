const express = require('express')
const router  = express.Router()
const { body } = require('express-validator')

const {
  register, login, getMe, updateMe, changePassword, logout, googleAuth,
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

// ── Routes ────────────────────────────────────────────────
// Public
router.post('/otp/send',  otpSendRules,  validate, requestOtp)
router.post('/otp/login', otpLoginRules, validate, loginWithOtp)
router.post('/google',    googleRules,   validate, googleAuth)
router.post('/register', registerRules, validate, register)
router.post('/login',    loginRules,    validate, login)

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
