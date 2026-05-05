const mongoose = require('mongoose')

const otpCodeSchema = new mongoose.Schema(
  {
    email:     { type: String, required: true, lowercase: true, trim: true },
    codeHash:  { type: String, required: true },
    purpose:   { type: String, enum: ['login', 'register'], required: true },
    expiresAt: { type: Date, required: true },
    attempts:  { type: Number, default: 0 },
  },
  { timestamps: true }
)

otpCodeSchema.index({ email: 1, purpose: 1 })
otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model('OtpCode', otpCodeSchema)
