const express  = require('express')
const router   = express.Router()
const { body } = require('express-validator')

const { query, getSessions } = require('../controllers/aiController')
const { protect }            = require('../middleware/auth')
const validate               = require('../middleware/validate')

// All AI routes require auth
router.use(protect)

const queryRules = [
  body('message')
    .notEmpty().withMessage('Message is required')
    .isString().withMessage('Message must be a string')
    .isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),
  body('history')
    .optional()
    .isArray().withMessage('History must be an array'),
]

router.post('/query',    queryRules, validate, query)
router.get('/sessions',  getSessions)

module.exports = router
