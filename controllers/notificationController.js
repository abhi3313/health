const Notification = require('../models/Notification')

// ── GET /api/notifications ─────────────────────────────
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate('sender', 'name email')
      .sort({ createdAt: -1 })
      .limit(50)
    
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    })

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' })
  }
}

// ── GET /api/notifications/unread-count ────────────────
const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false,
    })

    res.json({
      success: true,
      data: { unreadCount },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch unread count' })
  }
}

// ── PUT /api/notifications/:id/read ────────────────────
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { read: true },
      { new: true }
    )

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' })
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: { notification },
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notification as read' })
  }
}

// ── PUT /api/notifications/mark-all-read ───────────────
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, read: false },
      { read: true }
    )

    res.json({
      success: true,
      message: 'All notifications marked as read',
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark notifications as read' })
  }
}

// ── DELETE /api/notifications/:id ──────────────────────
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
    })

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' })
    }

    res.json({
      success: true,
      message: 'Notification deleted',
    })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete notification' })
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
}
