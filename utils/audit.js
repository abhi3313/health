const AuditLog = require('../models/AuditLog')

async function writeAuditLog(entry) {
  try {
    return await AuditLog.create(entry)
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Audit log failed:', error.message)
    }
    return null
  }
}

module.exports = { writeAuditLog }
