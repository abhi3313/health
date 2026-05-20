const express = require('express')
const rateLimit = require('express-rate-limit')

const { getEmergencyProfileHandler } = require('../controllers/emergencyController')

const router = express.Router()

const emergencyLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 60 : 20,
  message: {
    success: false,
    message: 'Too many emergency access attempts. Please wait and try again.',
    data: null,
  },
  standardHeaders: true,
  legacyHeaders: false,
})

router.use(emergencyLimiter)

router.get('/:patientId', getEmergencyProfileHandler)

module.exports = router
