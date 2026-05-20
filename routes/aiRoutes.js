const express  = require('express')
const router   = express.Router()
const { body, param } = require('express-validator')

const {
  createConversationHandler,
  deleteConversationHandler,
  getConversationMessagesHandler,
  getConversationsHandler,
  getSessions,
  query,
} = require('../controllers/aiController')
const { protect, authorize } = require('../middleware/auth')
const validate               = require('../middleware/validate')

// AI mentor is available to patients only.
router.use(protect, authorize('patient'))

const queryRules = [
  body('message')
    .notEmpty().withMessage('Message is required')
    .isString().withMessage('Message must be a string')
    .isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters'),
  body('history')
    .optional()
    .isArray().withMessage('History must be an array'),
  body('sessionId')
    .optional()
    .isString().withMessage('Session ID must be a string'),
]

router.post('/conversations',
  body('title').optional().isString().isLength({ max: 120 }).withMessage('Title cannot exceed 120 characters'),
  validate,
  createConversationHandler,
)
router.get('/conversations', getConversationsHandler)
router.get('/conversations/:sessionId', getConversationMessagesHandler)
router.delete('/conversations/:sessionId',
  param('sessionId').notEmpty().isString().isLength({ max: 120 }).withMessage('Valid session ID is required'),
  validate,
  deleteConversationHandler,
)
router.post('/query',    queryRules, validate, query)
router.get('/sessions',  getSessions)
router.delete('/sessions/:sessionId',
  param('sessionId').notEmpty().isString().isLength({ max: 120 }).withMessage('Valid session ID is required'),
  validate,
  deleteConversationHandler,
)

module.exports = router
