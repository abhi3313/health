const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    type: {
      type: String,
      enum: [
        'access_request',      // Doctor requesting access to patient records
        'access_approved',     // Patient approved doctor access
        'access_rejected',     // Patient rejected doctor access
        'appointment_booked',  // Patient booked appointment
        'appointment_cancelled',
        'prescription_added',  // Doctor added prescription
        'record_shared',       // Doctor shared a record
        'doctor_approved',     // Admin approved doctor account
        'doctor_rejected',     // Admin rejected doctor account
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    relatedModel: { type: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
)

notificationSchema.index({ recipient: 1, read: 1 })
notificationSchema.index({ recipient: 1, createdAt: -1 })

module.exports = mongoose.model('Notification', notificationSchema)
