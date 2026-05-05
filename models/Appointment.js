const mongoose = require('mongoose')

const appointmentSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: {
      type: Date,
      required: [true, 'Appointment date is required'],
    },
    time: {
      type: String,
      required: [true, 'Appointment time is required'],
    },
    reason: {
      type: String,
      required: [true, 'Reason for appointment is required'],
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no-show'],
      default: 'pending',
    },
    type: {
      type: String,
      enum: ['in-person', 'virtual', 'follow-up'],
      default: 'in-person',
    },
    notes:          { type: String, default: '' },
    doctorNotes:    { type: String, default: '' },
    cancelReason:   { type: String, default: '' },
    completedAt:    { type: Date },
    reminderSent:   { type: Boolean, default: false },
    fee:            { type: Number, default: 0 },
    isPaid:         { type: Boolean, default: false },
  },
  { timestamps: true }
)

appointmentSchema.index({ patient: 1, date: -1 })
appointmentSchema.index({ doctor: 1, date: 1 })
appointmentSchema.index({ status: 1 })

module.exports = mongoose.model('Appointment', appointmentSchema)
