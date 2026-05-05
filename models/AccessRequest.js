const mongoose = require('mongoose')

const accessRequestSchema = new mongoose.Schema(
  {
    // The doctor requesting access
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The patient being requested
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The unique patient ID used to find the patient
    patientUniqueId: {
      type: String,
      required: true,
    },
    // Current status of the request
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'revoked'],
      default: 'pending',
    },
    // Optional message from doctor when requesting
    requestMessage: {
      type: String,
      default: '',
      maxlength: 500,
    },
    // Optional reason when patient rejects or revokes
    responseMessage: {
      type: String,
      default: '',
      maxlength: 500,
    },
    // What the doctor is allowed to do (permissions)
    permissions: {
      viewRecords:        { type: Boolean, default: true },
      viewReports:        { type: Boolean, default: true },
      addNotes:           { type: Boolean, default: true },
      createPrescriptions:{ type: Boolean, default: true },
    },
    // Timestamps for each state change
    requestedAt:  { type: Date, default: Date.now },
    approvedAt:   { type: Date },
    rejectedAt:   { type: Date },
    revokedAt:    { type: Date },

    // Optional access expiry (null = no expiry)
    expiresAt: { type: Date, default: null },

    // Track if doctor has been notified
    doctorNotified: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Prevent duplicate pending/approved requests from same doctor to same patient
accessRequestSchema.index({ doctor: 1, patient: 1 }, { unique: false })
accessRequestSchema.index({ patient: 1, status: 1 })
accessRequestSchema.index({ doctor: 1, status: 1 })
accessRequestSchema.index({ patientUniqueId: 1 })

// Virtual: is access currently active?
accessRequestSchema.virtual('isActive').get(function () {
  if (this.status !== 'approved') return false
  if (this.expiresAt && new Date() > this.expiresAt) return false
  return true
})

// Virtual: is access expired?
accessRequestSchema.virtual('isExpired').get(function () {
  return this.expiresAt && new Date() > this.expiresAt
})

module.exports = mongoose.model('AccessRequest', accessRequestSchema)
