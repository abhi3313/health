const AccessRequest = require('../models/AccessRequest')

/**
 * Middleware: verify that a doctor has active approved access to a patient.
 * Expects :patientId in route params.
 * Usage: router.get('/patients/:patientId/records', protect, authorize('doctor'), requirePatientAccess, handler)
 */
const requirePatientAccess = async (req, res, next) => {
  const patientId = req.params.patientId || req.params.id

  if (!patientId) {
    return res.status(400).json({ success: false, message: 'Patient ID is required.' })
  }

  const access = await AccessRequest.findOne({
    doctor:  req.user._id,
    patient: patientId,
    status:  'approved',
  })

  if (!access) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have an approved access request for this patient.',
      data: { code: 'NO_ACCESS' },
    })
  }

  if (access.isExpired) {
    // Auto-mark as expired
    access.status = 'revoked'
    access.revokedAt = new Date()
    access.responseMessage = 'Access expired automatically'
    await access.save().catch(() => {})

    return res.status(403).json({
      success: false,
      message: 'Your access to this patient has expired. Please send a new request.',
      data: { code: 'ACCESS_EXPIRED' },
    })
  }

  // Attach access info to request for use in controllers
  req.patientAccess = access
  next()
}

/**
 * Middleware: verify a specific permission within an approved access.
 * Usage: requirePermission('viewRecords')
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.patientAccess) {
      return res.status(403).json({ success: false, message: 'Access check not performed.' })
    }
    if (!req.patientAccess.permissions[permission]) {
      return res.status(403).json({
        success: false,
        message: `You do not have permission to: ${permission}.`,
        data: { code: 'PERMISSION_DENIED', permission },
      })
    }
    next()
  }
}

module.exports = { requirePatientAccess, requirePermission }
