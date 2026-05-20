const express = require('express')
const { protect } = require('../middleware/auth')
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notificationController')

const router = express.Router()

// All notification routes require authentication
router.use(protect)

// ── GET notifications
router.get('/unread-count', getUnreadCount)
router.get('/', getNotifications)

// ── PUT mark as read
router.put('/mark-all/read', markAllAsRead)
router.put('/:id/read', markAsRead)

// ── DELETE notification
router.delete('/:id', deleteNotification)

module.exports = router
