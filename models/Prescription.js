const mongoose = require('mongoose')

const prescriptionSchema = new mongoose.Schema(
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
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    diagnosis: {
      type: String,
      required: [true, 'Diagnosis is required'],
      trim: true,
    },
    medications: [
      {
        name:      { type: String, required: true },
        dosage:    { type: String, required: true },
        frequency: { type: String, required: true },
        duration:  { type: String, required: true },
        route:     { type: String, default: 'oral' },
        instructions: { type: String, default: '' },
      },
    ],
    instructions: { type: String, default: '' },
    followUpDate: { type: Date },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled'],
      default: 'active',
    },
    validUntil: { type: Date },
    refillsAllowed:    { type: Number, default: 0 },
    refillsRemaining:  { type: Number, default: 0 },
  },
  { timestamps: true }
)

prescriptionSchema.index({ patient: 1, createdAt: -1 })
prescriptionSchema.index({ doctor: 1 })

module.exports = mongoose.model('Prescription', prescriptionSchema)
