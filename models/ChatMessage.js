const mongoose = require('mongoose')

const chatMessageSchema = new mongoose.Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20000,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
)

chatMessageSchema.index({ userId: 1, sessionId: 1, timestamp: 1 })

module.exports = mongoose.model('ChatMessage', chatMessageSchema)
