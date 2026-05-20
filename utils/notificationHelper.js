const Notification = require('../models/Notification')

// Create a notification for user(s)
const createNotification = async ({
  recipientId,      // Can be a single ID or array of IDs
  senderId,         // User who triggered the notification
  type,             // Notification type
  title,            // Notification title
  message,          // Notification message (optional)
  relatedId,        // ID of related document (e.g., AccessRequest._id)
  relatedModel,     // Model name of related document (e.g., 'AccessRequest')
}) => {
  try {
    const recipients = Array.isArray(recipientId) ? recipientId : [recipientId]
    
    const notifications = recipients.map(id => ({
      recipient: id,
      sender: senderId,
      type,
      title,
      message,
      relatedId,
      relatedModel,
    }))

    await Notification.insertMany(notifications)
  } catch (error) {
    console.error('Error creating notification:', error)
  }
}

module.exports = {
  createNotification,
}
