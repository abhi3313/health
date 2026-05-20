'use strict'

const {
  getEmergencyProfile,
  logEmergencyAccess,
  validatePatientId,
} = require('../services/emergencyService')

const getEmergencyProfileHandler = async (req, res) => {
  const validation = validatePatientId(req.params.patientId)

  if (!validation.isValid) {
    await logEmergencyAccess({
      patientId: validation.patientId,
      success: false,
      reason: 'INVALID_PATIENT_ID',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })

    return res.status(400).json({
      success: false,
      message: 'Please enter a valid Patient ID.',
      data: null,
    })
  }

  const result = await getEmergencyProfile(validation.patientId)

  if (result.error === 'NOT_FOUND') {
    await logEmergencyAccess({
      patientId: validation.patientId,
      success: false,
      reason: 'NOT_FOUND',
      ip: req.ip,
      userAgent: req.get('user-agent'),
    })

    return res.status(404).json({
      success: false,
      message: 'No emergency profile found for this Patient ID.',
      data: null,
    })
  }

  await logEmergencyAccess({
    patientId: validation.patientId,
    success: true,
    reason: 'PROFILE_VIEWED',
    patientObjectId: result.patientObjectId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  res.json({
    success: true,
    message: 'Emergency profile fetched',
    data: { emergencyProfile: result.profile },
  })
}

module.exports = {
  getEmergencyProfileHandler,
}
