const AccessRequest = require('../models/AccessRequest')
const User          = require('../models/User')
const HealthRecord  = require('../models/HealthRecord')
const Report        = require('../models/Report')
const Prescription  = require('../models/Prescription')

// ══════════════════════════════════════════════════════════════
// DOCTOR SIDE
// ══════════════════════════════════════════════════════════════

// POST /api/access/request
// Doctor sends access request using patient's unique ID
const requestAccess = async (req, res) => {
  const { patientUniqueId, requestMessage } = req.body
  const doctorId = req.user._id

  if (!patientUniqueId) {
    return res.status(400).json({ success: false, message: 'Patient Unique ID is required.' })
  }

  // Find the patient by unique ID
  const patient = await User.findOne({
    patientUniqueId: patientUniqueId.trim().toUpperCase(),
    role: 'patient',
    status: 'active',
  })

  if (!patient) {
    return res.status(404).json({
      success: false,
      message: 'No active patient found with this ID. Please check the ID and try again.',
    })
  }

  // Prevent doctor from requesting access to themselves
  if (String(patient._id) === String(doctorId)) {
    return res.status(400).json({ success: false, message: 'Invalid request.' })
  }

  // Check for existing active / pending request
  const existing = await AccessRequest.findOne({
    doctor:  doctorId,
    patient: patient._id,
    status:  { $in: ['pending', 'approved'] },
  })

  if (existing) {
    const msg = existing.status === 'approved'
      ? 'You already have approved access to this patient.'
      : 'You already have a pending access request for this patient.'
    return res.status(409).json({ success: false, message: msg })
  }

  // Create the request
  const accessRequest = await AccessRequest.create({
    doctor:          doctorId,
    patient:         patient._id,
    patientUniqueId: patient.patientUniqueId,
    requestMessage:  requestMessage || '',
    status:          'pending',
  })

  await accessRequest.populate([
    { path: 'doctor',  select: 'name email specialization hospital' },
    { path: 'patient', select: 'name email patientUniqueId' },
  ])

  res.status(201).json({
    success: true,
    message: `Access request sent to ${patient.name}. Waiting for their approval.`,
    data: { accessRequest },
  })
}

// GET /api/access/my-requests  (doctor views their sent requests)
const getDoctorRequests = async (req, res) => {
  const { status } = req.query
  const filter = { doctor: req.user._id }
  if (status) filter.status = status

  const requests = await AccessRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('patient', 'name email patientUniqueId dateOfBirth bloodGroup gender phone')

  res.json({
    success: true,
    message: 'Access requests fetched',
    data: { requests },
  })
}

// GET /api/access/approved-patients  (doctor sees all currently approved patients)
const getApprovedPatients = async (req, res) => {
  const requests = await AccessRequest.find({
    doctor: req.user._id,
    status: 'approved',
  })
    .sort({ approvedAt: -1 })
    .populate('patient', 'name email patientUniqueId dateOfBirth bloodGroup gender phone address allergies chronicConditions')

  // Filter out expired ones
  const active = requests.filter(r => r.isActive)

  res.json({
    success: true,
    message: 'Approved patients fetched',
    data: { patients: active },
  })
}

// DELETE /api/access/requests/:id  (doctor withdraws a pending request)
const withdrawRequest = async (req, res) => {
  const request = await AccessRequest.findOne({
    _id:    req.params.id,
    doctor: req.user._id,
    status: 'pending',
  })

  if (!request) {
    return res.status(404).json({ success: false, message: 'Pending request not found.' })
  }

  await request.deleteOne()
  res.json({ success: true, message: 'Access request withdrawn.', data: null })
}

// ══════════════════════════════════════════════════════════════
// PATIENT SIDE
// ══════════════════════════════════════════════════════════════

// GET /api/access/incoming  (patient sees incoming requests)
const getIncomingRequests = async (req, res) => {
  const { status } = req.query
  const filter = { patient: req.user._id }
  if (status) filter.status = status

  const requests = await AccessRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('doctor', 'name email specialization hospital licenseNumber experience avatar')

  res.json({
    success: true,
    message: 'Incoming access requests fetched',
    data: { requests },
  })
}

// PATCH /api/access/requests/:id/approve  (patient approves)
const approveRequest = async (req, res) => {
  const request = await AccessRequest.findOne({
    _id:    req.params.id,
    patient: req.user._id,
    status: 'pending',
  })

  if (!request) {
    return res.status(404).json({ success: false, message: 'Pending request not found.' })
  }

  request.status     = 'approved'
  request.approvedAt = new Date()
  request.responseMessage = req.body.message || ''

  // Optional: set custom permissions from patient
  if (req.body.permissions) {
    request.permissions = { ...request.permissions, ...req.body.permissions }
  }

  // Optional: set expiry if patient wants time-limited access
  if (req.body.expiresInDays) {
    request.expiresAt = new Date(Date.now() + parseInt(req.body.expiresInDays) * 24 * 60 * 60 * 1000)
  }

  await request.save()
  await request.populate('doctor', 'name email specialization')

  res.json({
    success: true,
    message: `Access granted to Dr. ${request.doctor.name}.`,
    data: { request },
  })
}

// PATCH /api/access/requests/:id/reject  (patient rejects)
const rejectRequest = async (req, res) => {
  const request = await AccessRequest.findOne({
    _id:     req.params.id,
    patient: req.user._id,
    status:  'pending',
  })

  if (!request) {
    return res.status(404).json({ success: false, message: 'Pending request not found.' })
  }

  request.status     = 'rejected'
  request.rejectedAt = new Date()
  request.responseMessage = req.body.message || ''
  await request.save()
  await request.populate('doctor', 'name email specialization')

  res.json({
    success: true,
    message: `Access request from Dr. ${request.doctor.name} rejected.`,
    data: { request },
  })
}

// PATCH /api/access/requests/:id/revoke  (patient revokes previously approved access)
const revokeAccess = async (req, res) => {
  const request = await AccessRequest.findOne({
    _id:     req.params.id,
    patient: req.user._id,
    status:  'approved',
  })

  if (!request) {
    return res.status(404).json({ success: false, message: 'Approved access not found.' })
  }

  request.status    = 'revoked'
  request.revokedAt = new Date()
  request.responseMessage = req.body.message || ''
  await request.save()
  await request.populate('doctor', 'name email specialization')

  res.json({
    success: true,
    message: `Access revoked from Dr. ${request.doctor.name}. They can no longer view your records.`,
    data: { request },
  })
}

// GET /api/access/my-doctors  (patient sees all doctors with current access)
const getMyDoctors = async (req, res) => {
  const requests = await AccessRequest.find({
    patient: req.user._id,
    status:  { $in: ['pending', 'approved', 'rejected', 'revoked'] },
  })
    .sort({ updatedAt: -1 })
    .populate('doctor', 'name email specialization hospital licenseNumber experience avatar')

  res.json({
    success: true,
    message: 'My doctors list fetched',
    data: { requests },
  })
}

// GET /api/access/patient-id  (patient gets their own unique ID)
const getMyPatientId = async (req, res) => {
  const patient = await User.findById(req.user._id).select('patientUniqueId name')

  if (!patient.patientUniqueId) {
    // Generate one if missing (backward compat)
    const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const random = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    patient.patientUniqueId = `HG-P-${random(4)}-${random(4)}`
    await patient.save({ validateBeforeSave: false })
  }

  res.json({
    success: true,
    message: 'Your Patient ID fetched',
    data: { patientUniqueId: patient.patientUniqueId },
  })
}

// ══════════════════════════════════════════════════════════════
// DOCTOR ACCESS GUARD – check before accessing patient data
// ══════════════════════════════════════════════════════════════

// GET /api/access/check/:patientId
const checkAccess = async (req, res) => {
  const request = await AccessRequest.findOne({
    doctor:  req.user._id,
    patient: req.params.patientId,
    status:  'approved',
  })

  const hasAccess = !!(request && request.isActive)

  res.json({
    success: true,
    message: hasAccess ? 'Access granted' : 'Access denied',
    data: {
      hasAccess,
      permissions:  hasAccess ? request.permissions : null,
      approvedAt:   hasAccess ? request.approvedAt  : null,
      expiresAt:    hasAccess ? request.expiresAt    : null,
      requestId:    hasAccess ? request._id          : null,
    },
  })
}

// ══════════════════════════════════════════════════════════════
// DOCTOR – view approved patient's data
// ══════════════════════════════════════════════════════════════

// GET /api/access/patients/:patientId/records
const getApprovedPatientRecords = async (req, res) => {
  // Verify doctor has approved active access
  const access = await AccessRequest.findOne({
    doctor:  req.user._id,
    patient: req.params.patientId,
    status:  'approved',
  })

  if (!access || !access.isActive) {
    return res.status(403).json({
      success: false,
      message: 'You do not have approved access to this patient\'s records.',
    })
  }

  if (!access.permissions.viewRecords) {
    return res.status(403).json({ success: false, message: 'You do not have permission to view records.' })
  }

  const patient = await User.findById(req.params.patientId).select('-password')
  const records = await HealthRecord.find({ patient: req.params.patientId }).sort({ createdAt: -1 })
  const reports = access.permissions.viewReports
    ? await Report.find({ patient: req.params.patientId, isArchived: false }).sort({ createdAt: -1 })
    : []
  const prescriptions = await Prescription.find({ patient: req.params.patientId }).sort({ createdAt: -1 })

  res.json({
    success: true,
    message: 'Patient data fetched successfully',
    data: {
      patient:       patient.toSafeObject(),
      records,
      reports,
      prescriptions,
      access: {
        approvedAt:  access.approvedAt,
        expiresAt:   access.expiresAt,
        permissions: access.permissions,
      },
    },
  })
}

module.exports = {
  // Doctor
  requestAccess,
  getDoctorRequests,
  getApprovedPatients,
  withdrawRequest,
  checkAccess,
  getApprovedPatientRecords,
  // Patient
  getIncomingRequests,
  approveRequest,
  rejectRequest,
  revokeAccess,
  getMyDoctors,
  getMyPatientId,
}
