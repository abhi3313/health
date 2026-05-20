const mongoose       = require('mongoose')
const User           = require('../models/User')
const HealthRecord   = require('../models/HealthRecord')
const Appointment    = require('../models/Appointment')
const Prescription   = require('../models/Prescription')
const Vital          = require('../models/Vital')
const AccessRequest  = require('../models/AccessRequest')
const { assertDoctorCanManagePatient } = require('../utils/doctorPatientAccess')

/** Consistent ObjectId for doctor ref queries (JWT / lean / string edge cases). */
function normalizeDoctorId(doctorId) {
  if (doctorId == null) return doctorId
  const s = String(doctorId)
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : doctorId
}

function parseSearchQuery(search) {
  if (search == null) return ''
  if (Array.isArray(search)) return String(search[0] ?? '').trim()
  if (typeof search === 'string') return search.trim()
  return String(search).trim()
}

/** Non-expired approved access (same rule as accessController.getApprovedPatients). */
function isApprovedAccessActive(r) {
  if (!r || r.status !== 'approved') return false
  if (r.expiresAt && new Date() > new Date(r.expiresAt)) return false
  return true
}

/** Safe substring for MongoDB $regex (user-supplied search). */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function startOfLocalDay(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function startOfWeek(date = new Date()) {
  const d = startOfLocalDay(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

/** Patients linked via appointments OR approved patient consent (AccessRequest). */
async function getMergedDoctorPatientIds(doctorId) {
  const docRef = normalizeDoctorId(doctorId)
  const [fromAppointments, accessRows] = await Promise.all([
    Appointment.distinct('patient', { doctor: docRef }),
    AccessRequest.find({ doctor: docRef, status: 'approved' }).select('patient expiresAt status').lean(),
  ])
  const idSet = new Set(fromAppointments.map((id) => String(id)))
  const activeAccess = accessRows.filter(isApprovedAccessActive)
  activeAccess.forEach((r) => idSet.add(String(r.patient)))
  return idSet
}

// ─── DASHBOARD ─────────────────────────────────────────────
const getDashboard = async (req, res) => {
  const doctorId = req.user._id
  const todayStart = startOfLocalDay()
  const tomorrowStart = addDays(todayStart, 1)
  const weekStart = startOfWeek()
  const weekEnd = addDays(weekStart, 7)

  const patientIdSet = await getMergedDoctorPatientIds(doctorId)
  const totalPatients = patientIdSet.size

  const docRef = normalizeDoctorId(doctorId)

  const [
    todayAppts,
    totalAppts,
    activePrescriptions,
    recordsAuthored,
    todayAppointments,
    weeklyAppointments,
  ] = await Promise.all([
    Appointment.countDocuments({ doctor: docRef, date: { $gte: todayStart, $lt: tomorrowStart } }),
    Appointment.countDocuments({ doctor: docRef }),
    Prescription.countDocuments({ doctor: docRef, status: 'active' }),
    HealthRecord.countDocuments({ doctor: docRef }),
    Appointment.find({ doctor: docRef, date: { $gte: todayStart, $lt: tomorrowStart } })
      .sort({ time: 1 })
      .populate('patient', 'name email phone bloodGroup'),
    Appointment.find({ doctor: docRef, date: { $gte: weekStart, $lt: weekEnd } }),
  ])

  // Build weekly chart – group by day name
  const days    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayMap  = Object.fromEntries(days.map((d, i) => {
    const date = addDays(weekStart, i)
    return [date.toISOString().slice(0, 10), {
      day: d,
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      appointments: 0,
    }]
  }))
  weeklyAppointments.forEach(a => {
    const key = startOfLocalDay(a.date).toISOString().slice(0, 10)
    if (dayMap[key]) dayMap[key].appointments += 1
  })
  const weeklyChart = Object.values(dayMap)

  // Get recent patients (unique) with last visit
  const recentAppointments = await Appointment.find({ doctor: docRef })
    .sort({ date: -1 })
    .limit(20)
    .populate('patient', 'name email bloodGroup dateOfBirth status')

  const seenIds = new Set()
  const recentPatients = []
  for (const apt of recentAppointments) {
    if (!apt.patient || seenIds.has(String(apt.patient._id))) continue
    seenIds.add(String(apt.patient._id))
    recentPatients.push({
      _id:        apt.patient._id,
      name:       apt.patient.name,
      email:      apt.patient.email,
      bloodGroup: apt.patient.bloodGroup,
      status:     apt.patient.status,
      age:        apt.patient.dateOfBirth
        ? Math.floor((Date.now() - new Date(apt.patient.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
        : null,
      lastVisit: apt.date,
      recordCount: 0,
    })
    if (recentPatients.length >= 8) break
  }

  // Include patients who approved access but may have no appointments yet
  if (recentPatients.length < 8) {
    const accessRecent = await AccessRequest.find({ doctor: doctorId, status: 'approved' })
      .sort({ approvedAt: -1 })
      .limit(12)
      .populate('patient', 'name email bloodGroup dateOfBirth status')

    for (const ar of accessRecent) {
      if (!ar.patient || seenIds.has(String(ar.patient._id))) continue
      if (!isApprovedAccessActive(ar)) continue
      seenIds.add(String(ar.patient._id))
      recentPatients.push({
        _id:         ar.patient._id,
        name:        ar.patient.name,
        email:       ar.patient.email,
        bloodGroup:  ar.patient.bloodGroup,
        status:      ar.patient.status,
        age:         ar.patient.dateOfBirth
          ? Math.floor((Date.now() - new Date(ar.patient.dateOfBirth)) / (1000 * 60 * 60 * 24 * 365.25))
          : null,
        lastVisit:   ar.approvedAt || ar.createdAt,
        recordCount: 0,
      })
      if (recentPatients.length >= 8) break
    }
  }

  // Attach record counts
  await Promise.all(
    recentPatients.map(async p => {
      p.recordCount = await HealthRecord.countDocuments({ patient: p._id })
    })
  )

  const formattedToday = todayAppointments.map(a => ({
    _id:         a._id,
    patientName: a.patient?.name,
    time:        a.time,
    reason:      a.reason,
    status:      a.status,
    type:        a.type,
  }))

  res.json({
    success: true,
    message: 'Doctor dashboard fetched successfully',
    data: {
      stats: {
        totalPatients,
        todayAppts,
        recordsReviewed: recordsAuthored,
        prescriptions:   activePrescriptions,
      },
      todayAppointments: formattedToday,
      recentPatients,
      weeklyChart,
    },
  })
}

// ─── PATIENTS ──────────────────────────────────────────────
const getPatients = async (req, res) => {
  const doctorId = req.user._id
  const docRef   = normalizeDoctorId(doctorId)
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
  const q     = parseSearchQuery(req.query.search)

  // ── Search mode (e.g. Request Access "search by name") — scan patients, NOT "my patients" only.
  if (q.length > 0) {
    if (q.length < 2) {
      return res.json({
        success: true,
        message: 'Patients fetched successfully',
        data: { patients: [], total: 0, page: 1, pages: 0 },
      })
    }
    const safe = escapeRegex(q)
    const directoryFilter = {
      role:   'patient',
      status: { $ne: 'suspended' },
      $or: [
        { name:  { $regex: safe, $options: 'i' } },
        { email: { $regex: safe, $options: 'i' } },
      ],
    }
    const skip = (page - 1) * limit
    const [patients, total] = await Promise.all([
      User.find(directoryFilter).select('-password').skip(skip).limit(limit).sort({ name: 1 }),
      User.countDocuments(directoryFilter),
    ])
    const augmented = patients.map((p) => {
      const obj = p.toSafeObject()
      obj.recordCount = 0
      obj.lastVisit = null
      return obj
    })
    return res.json({
      success: true,
      message: 'Patients fetched successfully',
      data: {
        patients: augmented,
        total,
        page,
        pages: Math.ceil(total / limit) || 0,
      },
    })
  }

  // ── My Patients list — appointments + approved access only (no ?search=)
  const mergedIds = await getMergedDoctorPatientIds(doctorId)
  const patientIds = [...mergedIds]

  if (patientIds.length === 0) {
    return res.json({
      success: true,
      message: 'Patients fetched successfully',
      data: { patients: [], total: 0, page, pages: 0 },
    })
  }

  const filter = { _id: { $in: patientIds }, role: 'patient' }
  const skip = (page - 1) * limit
  const [patients, total] = await Promise.all([
    User.find(filter).select('-password').skip(skip).limit(limit).sort({ createdAt: -1 }),
    User.countDocuments(filter),
  ])

  const augmented = await Promise.all(
    patients.map(async (p) => {
      const obj = p.toSafeObject()
      const [recordCount, lastApt, access] = await Promise.all([
        HealthRecord.countDocuments({ patient: p._id }),
        Appointment.findOne({ doctor: docRef, patient: p._id }).sort({ date: -1 }),
        AccessRequest.findOne({ doctor: docRef, patient: p._id, status: 'approved' }).sort({ approvedAt: -1 }),
      ])
      obj.recordCount = recordCount
      obj.lastVisit   = lastApt?.date || access?.approvedAt || null
      return obj
    })
  )

  res.json({
    success: true,
    message: 'Patients fetched successfully',
    data: { patients: augmented, total, page, pages: Math.ceil(total / limit) || 0 },
  })
}

const getPatient = async (req, res) => {
  const patient = await User.findOne({ _id: req.params.id, role: 'patient' }).select('-password')
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' })

  const denied = await assertDoctorCanManagePatient(req.user._id, req.params.id)
  if (denied) return res.status(denied.code).json({ success: false, message: denied.message })

  const [records, vitals, prescriptions, appointments] = await Promise.all([
    HealthRecord.find({ patient: patient._id }).sort({ createdAt: -1 }).limit(10),
    Vital.findOne({ patient: patient._id }).sort({ recordedAt: -1 }),
    Prescription.find({ patient: patient._id, status: 'active' }).limit(5),
    Appointment.find({ doctor: req.user._id, patient: patient._id }).sort({ date: -1 }).limit(5),
  ])

  res.json({
    success: true,
    message: 'Patient detail fetched',
    data: {
      patient: patient.toSafeObject(),
      records,
      latestVitals: vitals,
      activePrescriptions: prescriptions,
      appointments,
    },
  })
}

const getPatientRecords = async (req, res) => {
  const denied = await assertDoctorCanManagePatient(req.user._id, req.params.id)
  if (denied) return res.status(denied.code).json({ success: false, message: denied.message })

  const { type, page = 1, limit = 20 } = req.query
  const filter = { patient: req.params.id }
  if (type) filter.type = type

  const skip = (parseInt(page) - 1) * parseInt(limit)
  const [records, total] = await Promise.all([
    HealthRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    HealthRecord.countDocuments(filter),
  ])

  res.json({
    success: true,
    message: 'Patient records fetched',
    data: { records, total, page: parseInt(page) },
  })
}

// ─── DOCTOR ADDS RECORD FOR PATIENT ────────────────────────
const addPatientRecord = async (req, res) => {
  const patient = await User.findOne({ _id: req.params.id, role: 'patient' })
  if (!patient) return res.status(404).json({ success: false, message: 'Patient not found.' })

  const denied = await assertDoctorCanManagePatient(req.user._id, req.params.id)
  if (denied) return res.status(denied.code).json({ success: false, message: denied.message })

  const record = await HealthRecord.create({
    ...req.body,
    patient:            req.params.id,
    doctor:             req.user._id,
    isSharedWithDoctor: true,
  })

  res.status(201).json({ success: true, message: 'Medical record added successfully', data: { record } })
}

// ─── NOTES ─────────────────────────────────────────────────
const addNote = async (req, res) => {
  const { content, type = 'General Checkup', severity } = req.body
  if (!content) return res.status(400).json({ success: false, message: 'Note content is required.' })

  const denied = await assertDoctorCanManagePatient(req.user._id, req.params.id)
  if (denied) return res.status(denied.code).json({ success: false, message: denied.message })

  const record = await HealthRecord.create({
    patient:     req.params.id,
    doctor:      req.user._id,
    type:        type,
    description: content,
    severity:    severity || '',
    isSharedWithDoctor: true,
  })

  res.status(201).json({ success: true, message: 'Note added successfully', data: { record } })
}

// ─── APPOINTMENTS ──────────────────────────────────────────
const getAppointments = async (req, res) => {
  const { status, date, page = 1, limit = 20 } = req.query
  const filter = { doctor: req.user._id }
  if (status) filter.status = status
  if (date) {
    const d = new Date(date)
    filter.date = {
      $gte: new Date(d.setHours(0, 0, 0, 0)),
      $lte: new Date(d.setHours(23, 59, 59, 999)),
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)
  const [appointments, total] = await Promise.all([
    Appointment.find(filter)
      .sort({ date: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('patient', 'name email phone bloodGroup'),
    Appointment.countDocuments(filter),
  ])

  res.json({
    success: true,
    message: 'Appointments fetched',
    data: { appointments, total, page: parseInt(page) },
  })
}

const updateAppointment = async (req, res) => {
  const allowed = ['status', 'doctorNotes', 'completedAt', 'cancelReason']
  const update  = {}
  allowed.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f] })

  if (update.status === 'completed') update.completedAt = new Date()

  const appointment = await Appointment.findOneAndUpdate(
    { _id: req.params.id, doctor: req.user._id },
    update,
    { new: true, runValidators: true }
  ).populate('patient', 'name email')

  if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' })
  res.json({ success: true, message: 'Appointment updated', data: { appointment } })
}

// ─── PRESCRIPTIONS ─────────────────────────────────────────
const getPatientPrescriptions = async (req, res) => {
  const denied = await assertDoctorCanManagePatient(req.user._id, req.params.id)
  if (denied) return res.status(denied.code).json({ success: false, message: denied.message })

  const prescriptions = await Prescription.find({ patient: req.params.id })
    .sort({ createdAt: -1 })
    .populate('patient', 'name email')
  res.json({ success: true, message: 'Prescriptions fetched', data: { prescriptions } })
}

const addPrescription = async (req, res) => {
  const { diagnosis, medications, instructions, followUpDate, validUntil, appointmentId } = req.body

  if (!diagnosis || !medications?.length) {
    return res.status(400).json({ success: false, message: 'Diagnosis and at least one medication are required.' })
  }

  const denied = await assertDoctorCanManagePatient(req.user._id, req.params.id)
  if (denied) return res.status(denied.code).json({ success: false, message: denied.message })

  const prescription = await Prescription.create({
    patient:     req.params.id,
    doctor:      req.user._id,
    appointment: appointmentId,
    diagnosis,
    medications,
    instructions,
    followUpDate,
    validUntil,
    refillsAllowed:   req.body.refillsAllowed   || 0,
    refillsRemaining: req.body.refillsAllowed   || 0,
  })

  await prescription.populate('patient', 'name email')
  res.status(201).json({ success: true, message: 'Prescription created successfully', data: { prescription } })
}

// ─── STATS ─────────────────────────────────────────────────
const getStats = async (req, res) => {
  const doctorId   = req.user._id
  const docRef     = normalizeDoctorId(doctorId)
  const merged     = await getMergedDoctorPatientIds(doctorId)

  const [totalPatients, totalAppts, pending, completed, totalRx] = await Promise.all([
    Promise.resolve(merged.size),
    Appointment.countDocuments({ doctor: docRef }),
    Appointment.countDocuments({ doctor: docRef, status: 'pending' }),
    Appointment.countDocuments({ doctor: docRef, status: 'completed' }),
    Prescription.countDocuments({ doctor: docRef, status: 'active' }),
  ])

  res.json({
    success: true,
    message: 'Stats fetched',
    data: { totalPatients, totalAppointments: totalAppts, pendingAppointments: pending, completedAppointments: completed, totalPrescriptions: totalRx },
  })
}

module.exports = {
  getDashboard, getStats,
  getPatients, getPatient, getPatientRecords, addPatientRecord,
  addNote,
  getAppointments, updateAppointment,
  getPatientPrescriptions, addPrescription,
}
