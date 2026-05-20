const mongoose = require('mongoose')

const auditLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    action: {
      type: String,
      required: true,
      enum: [
        'USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT',
        'USER_REGISTERED_OAUTH', 'USER_LOGIN_OAUTH',
        'DOCTOR_AWAITING_APPROVAL',
        'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
        'USER_STATUS_TOGGLED', 'DOCTOR_APPROVED', 'DOCTOR_REJECTED',
        'RECORD_CREATED', 'RECORD_UPDATED', 'RECORD_DELETED',
        'REPORT_UPLOADED', 'REPORT_DELETED',
        'APPOINTMENT_CREATED', 'APPOINTMENT_UPDATED', 'APPOINTMENT_CANCELLED',
        'PRESCRIPTION_CREATED',
        'VITAL_ADDED',
        'EMERGENCY_ACCESS',
        'AI_QUERY',
      ],
    },
    resource:   { type: String },
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    details:    { type: mongoose.Schema.Types.Mixed },
    ip:         { type: String },
    userAgent:  { type: String },
  },
  { timestamps: true }
)

auditLogSchema.index({ user: 1, createdAt: -1 })
auditLogSchema.index({ action: 1 })

module.exports = mongoose.model('AuditLog', auditLogSchema)
