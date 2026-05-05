const jwt  = require('jsonwebtoken')
const User = require('../models/User')

// ── Protect: verify JWT ────────────────────────────────────
const protect = async (req, res, next) => {
  let token

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    })
  }

  try {
    const decoded = jwt.verify(token,'healthguardian_super_secret_jwt_key_change_in_production') 

    const user = await User.findById(decoded.id).select('-password')
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Token is valid but user no longer exists.',
      })
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Contact admin.',
      })
    }

    req.user = user
    next()
  } catch (err) {
    const message =
      err.name === 'TokenExpiredError'  ? 'Session expired. Please login again.' :
      err.name === 'JsonWebTokenError'  ? 'Invalid token. Please login again.'   :
      'Authentication failed.'

    return res.status(401).json({ success: false, message })
  }
}

// ── Role Guard ─────────────────────────────────────────────
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. This route is restricted to: ${roles.join(', ')}.`,
      })
    }
    next()
  }
}

// ── Doctor must be approved ────────────────────────────────
const requireApproved = (req, res, next) => {
  if (req.user.role === 'doctor' && !req.user.isApproved) {
    return res.status(403).json({
      success: false,
      message: 'Your doctor account is pending admin approval.',
    })
  }
  next()
}

module.exports = { protect, authorize, requireApproved }
