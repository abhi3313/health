const HealthRecord  = require('../models/HealthRecord')
const Report        = require('../models/Report')
const Appointment   = require('../models/Appointment')
const Vital         = require('../models/Vital')
const Prescription  = require('../models/Prescription')
const User          = require('../models/User')
const path          = require('path')

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

function chartDateLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function dayKey(date) {
  const d = startOfLocalDay(date)
  return d.toISOString().slice(0, 10)
}

// ─── DASHBOARD ─────────────────────────────────────────────
const getDashboard = async (req, res) => {
  const patientId = req.user._id

  const [
    totalRecords,
    totalReports,
    totalAppointments,
    totalPrescriptions,
    upcomingAppointments,
    recentRecords,
    latestVital,
  ] = await Promise.all([
    HealthRecord.countDocuments({ patient: patientId }),
    Report.countDocuments({ patient: patientId, isArchived: false }),
    Appointment.countDocuments({ patient: patientId }),
    Prescription.countDocuments({ patient: patientId, status: 'active' }),
    Appointment.find({ patient: patientId, date: { $gte: new Date() }, status: { $in: ['pending', 'confirmed'] } })
      .sort({ date: 1 }).limit(5).populate('doctor', 'name specialization'),
    HealthRecord.find({ patient: patientId }).sort({ createdAt: -1 }).limit(5),
    Vital.findOne({ patient: patientId }).sort({ recordedAt: -1 }),
  ])

  // Format upcoming appointments
  const formattedAppointments = upcomingAppointments.map(apt => ({
    _id:        apt._id,
    date:       apt.date,
    time:       apt.time,
    reason:     apt.reason,
    status:     apt.status,
    doctorName: apt.doctor?.name,
    specialization: apt.doctor?.specialization,
  }))

  res.json({
    success: true,
    message: 'Dashboard fetched successfully',
    data: {
      stats: {
        totalRecords,
        appointments:  totalAppointments,
        prescriptions: totalPrescriptions,
        reports:       totalReports,
      },
      currentVitals: latestVital ? {
        heartRate:     latestVital.heartRate?.value,
        bloodPressure: latestVital.bloodPressure?.systolic
          ? `${latestVital.bloodPressure.systolic}/${latestVital.bloodPressure.diastolic}`
          : null,
        temperature:   latestVital.temperature?.value,
        oxygen:        latestVital.oxygenSaturation?.value,
        glucose:       latestVital.glucose?.value,
      } : {},
      upcomingAppointments: formattedAppointments,
      recentRecords,
    },
  })
}

// ─── STATS ─────────────────────────────────────────────────
const getStats = async (req, res) => {
  const id = req.user._id
  const [records, reports, appointments, prescriptions] = await Promise.all([
    HealthRecord.countDocuments({ patient: id }),
    Report.countDocuments({ patient: id }),
    Appointment.countDocuments({ patient: id }),
    Prescription.countDocuments({ patient: id, status: 'active' }),
  ])
  res.json({ success: true, message: 'Stats fetched', data: { records, reports, appointments, prescriptions } })
}

// ─── RECORDS ───────────────────────────────────────────────
const getRecords = async (req, res) => {
  const { type, status, page = 1, limit = 20, search } = req.query
  const filter = { patient: req.user._id }
  if (type)   filter.type   = type
  if (status) filter.status = status
  if (search) filter.description = { $regex: search, $options: 'i' }

  const skip    = (parseInt(page) - 1) * parseInt(limit)
  const [records, total] = await Promise.all([
    HealthRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).populate('doctor', 'name specialization'),
    HealthRecord.countDocuments(filter),
  ])

  res.json({
    success: true,
    message: 'Records fetched successfully',
    data: { records, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
  })
}

const getRecord = async (req, res) => {
  const record = await HealthRecord.findOne({ _id: req.params.id, patient: req.user._id }).populate('doctor', 'name specialization')
  if (!record) return res.status(404).json({ success: false, message: 'Record not found.' })
  res.json({ success: true, message: 'Record fetched', data: { record } })
}

const addRecord = async (req, res) => {
  // Validate date is not in the future
  if (req.body.date && new Date(req.body.date) > new Date()) {
    return res.status(400).json({ success: false, message: 'Record date cannot be in the future.' })
  }
  const record = await HealthRecord.create({ ...req.body, patient: req.user._id })
  res.status(201).json({ success: true, message: 'Health record added successfully', data: { record } })
}

const updateRecord = async (req, res) => {
  const existing = await HealthRecord.findOne({ _id: req.params.id, patient: req.user._id })
  if (!existing) return res.status(404).json({ success: false, message: 'Record not found.' })
  if (existing.doctor) {
    return res.status(403).json({
      success: false,
      message: 'Clinical records added by your doctor cannot be edited.',
    })
  }
  // Validate date is not in the future
  if (req.body.date && new Date(req.body.date) > new Date()) {
    return res.status(400).json({ success: false, message: 'Record date cannot be in the future.' })
  }
  const forbidden = ['patient', 'doctor']
  forbidden.forEach(f => delete req.body[f])
  const record = await HealthRecord.findOneAndUpdate(
    { _id: req.params.id, patient: req.user._id },
    req.body,
    { new: true, runValidators: true }
  )
  res.json({ success: true, message: 'Record updated successfully', data: { record } })
}

const deleteRecord = async (req, res) => {
  const record = await HealthRecord.findOne({ _id: req.params.id, patient: req.user._id })
  if (!record) return res.status(404).json({ success: false, message: 'Record not found.' })
  if (record.doctor) {
    return res.status(403).json({
      success: false,
      message: 'Clinical records added by your doctor cannot be deleted.',
    })
  }
  await record.deleteOne()
  res.json({ success: true, message: 'Record deleted successfully', data: null })
}

// ─── REPORTS ───────────────────────────────────────────────
const uploadReport = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded.' })

  const serverUrl = `${req.protocol}://${req.get('host')}`
  const report = await Report.create({
    patient:      req.user._id,
    filename:     req.file.filename,
    originalName: req.file.originalname,
    mimetype:     req.file.mimetype,
    size:         req.file.size,
    url:          `${serverUrl}/uploads/reports/${req.file.filename}`,
    tag:          req.body.tag || 'Report',
    description:  req.body.description || '',
    category:     req.body.category || 'other',
  })

  res.status(201).json({ success: true, message: 'Report uploaded successfully', data: { report } })
}

const getReports = async (req, res) => {
  const reports = await Report.find({ patient: req.user._id, isArchived: false }).sort({ createdAt: -1 })
  res.json({ success: true, message: 'Reports fetched', data: { reports } })
}

const deleteReport = async (req, res) => {
  const report = await Report.findOneAndDelete({ _id: req.params.id, patient: req.user._id })
  if (!report) return res.status(404).json({ success: false, message: 'Report not found.' })
  // Optionally delete file from disk here
  res.json({ success: true, message: 'Report deleted', data: null })
}

// ─── DOCTORS (booking) ─────────────────────────────────────
const listDoctorsForBooking = async (req, res) => {
  const raw = req.query.search
  const q = typeof raw === 'string' ? raw.trim() : Array.isArray(raw) ? String(raw[0] ?? '').trim() : ''
  const limit = Math.min(30, Math.max(1, parseInt(req.query.limit, 10) || 20))

  const filter = {
    role: 'doctor',
    isApproved: true,
    status: { $ne: 'suspended' },
  }
  if (q.length >= 2) {
    const safe = escapeRegex(q)
    filter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { specialization: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
    ]
  }

  const doctors = await User.find(filter)
    .select('name email specialization hospital experience')
    .sort({ name: 1 })
    .limit(limit)

  res.json({ success: true, message: 'Doctors fetched', data: { doctors } })
}

// ─── APPOINTMENTS ──────────────────────────────────────────
const getAppointments = async (req, res) => {
  const appointments = await Appointment.find({ patient: req.user._id })
    .sort({ date: -1 }).limit(50)
    .populate('doctor', 'name specialization hospital')
  res.json({ success: true, message: 'Appointments fetched', data: { appointments } })
}

const bookAppointment = async (req, res) => {
  const { doctorId, date, time, reason, type } = req.body
  if (!doctorId || !date || !time || !reason) {
    return res.status(400).json({ success: false, message: 'Doctor, date, time and reason are required.' })
  }
  const doctor = await User.findOne({
      _id: doctorId,
      role: 'doctor',
      isApproved: true,
      status: { $ne: 'suspended' },
    })
  if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found or not approved.' })

  const appointment = await Appointment.create({
    patient: req.user._id,
    doctor:  doctorId,
    date, time, reason, type,
  })
  await appointment.populate('doctor', 'name specialization')
  res.status(201).json({ success: true, message: 'Appointment booked successfully', data: { appointment } })
}

const cancelAppointment = async (req, res) => {
  const appointment = await Appointment.findOneAndUpdate(
    { _id: req.params.id, patient: req.user._id, status: { $in: ['pending', 'confirmed'] } },
    { status: 'cancelled', cancelReason: req.body.reason || '' },
    { new: true }
  )
  if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found or cannot be cancelled.' })
  res.json({ success: true, message: 'Appointment cancelled', data: { appointment } })
}

// ─── VITALS ────────────────────────────────────────────────
const getVitals = async (req, res) => {
  const { range = '7d' } = req.query
  const days  = range === '30d' ? 30 : range === '90d' ? 90 : 7
  const todayStart = startOfLocalDay()
  const since = addDays(todayStart, -(days - 1))
  const tomorrowStart = addDays(todayStart, 1)

  const vitals = await Vital.find({
    patient: req.user._id,
    recordedAt: { $gte: since, $lt: tomorrowStart },
  })
    .sort({ recordedAt: 1 })

  const latestByDay = new Map()
  vitals.forEach((v) => {
    latestByDay.set(dayKey(v.recordedAt), v)
  })

  const chart = []
  for (let i = 0; i < days; i += 1) {
    const date = addDays(since, i)
    const vital = latestByDay.get(dayKey(date))
    if (vital || days <= 7) {
      chart.push({
        date:      chartDateLabel(date),
        heartRate: vital?.heartRate?.value ?? null,
        oxygen:    vital?.oxygenSaturation?.value ?? null,
        glucose:   vital?.glucose?.value ?? null,
        systolic:  vital?.bloodPressure?.systolic ?? null,
      })
    }
  }

  const hasHeartRateValue = chart.some((row) => row.heartRate != null)

  res.json({
    success: true,
    message: 'Vitals fetched',
    data: {
      vitals,
      chart: hasHeartRateValue ? chart : [],
    },
  })
}

const addVital = async (req, res) => {
  const vital = await Vital.create({ ...req.body, patient: req.user._id, recordedBy: req.user._id })
  res.status(201).json({ success: true, message: 'Vital recorded successfully', data: { vital } })
}

// ─── PRESCRIPTIONS ─────────────────────────────────────────
const getPrescriptions = async (req, res) => {
  const prescriptions = await Prescription.find({ patient: req.user._id })
    .sort({ createdAt: -1 }).populate('doctor', 'name specialization')
  res.json({ success: true, message: 'Prescriptions fetched', data: { prescriptions } })
}

module.exports = {
  getDashboard, getStats,
  getRecords, getRecord, addRecord, updateRecord, deleteRecord,
  uploadReport, getReports, deleteReport,
  listDoctorsForBooking,
  getAppointments, bookAppointment, cancelAppointment,
  getVitals, addVital,
  getPrescriptions,
}
