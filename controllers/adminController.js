const User        = require('../models/User')
const HealthRecord= require('../models/HealthRecord')
const Appointment = require('../models/Appointment')
const Report      = require('../models/Report')
const Prescription= require('../models/Prescription')
const AuditLog    = require('../models/AuditLog')
const { writeAuditLog } = require('../utils/audit')
const { sendDoctorApprovalEmail } = require('../utils/mailer')
const bcrypt      = require('bcryptjs')
const fs          = require('fs')
const os          = require('os')
const process     = require('process')

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

function percentChange(current, previous) {
  if (!previous && !current) return 0
  if (!previous) return 100
  return Math.round(((current - previous) / previous) * 100)
}

function getDiskSpaceLabel() {
  if (typeof fs.statfsSync !== 'function') return 'Unavailable'
  try {
    const stats = fs.statfsSync(process.cwd())
    const available = stats.bavail * stats.bsize
    const total = stats.blocks * stats.bsize
    if (!total) return 'Unavailable'
    return `${((available / total) * 100).toFixed(1)}% free`
  } catch {
    return 'Unavailable'
  }
}

// ─── STATS ─────────────────────────────────────────────────
const getStats = async (req, res) => {
  const todayStart = new Date(new Date().setHours(0, 0, 0, 0))
  const last7Start = addDays(todayStart, -6)
  const prev7Start = addDays(last7Start, -7)

  const [
    totalUsers,
    totalPatients,
    totalDoctors,
    totalAdmins,
    totalRecords,
    totalAppointments,
    pendingDoctors,
    activeToday,
    newUsersLast7,
    newUsersPrev7,
    activeLast7,
    activePrev7,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'patient' }),
    User.countDocuments({ role: 'doctor' }),
    User.countDocuments({ role: 'admin' }),
    HealthRecord.countDocuments(),
    Appointment.countDocuments(),
    User.countDocuments({ role: 'doctor', isApproved: false }),
    User.countDocuments({ lastLogin: { $gte: todayStart } }),
    User.countDocuments({ createdAt: { $gte: last7Start } }),
    User.countDocuments({ createdAt: { $gte: prev7Start, $lt: last7Start } }),
    User.countDocuments({ lastLogin: { $gte: last7Start } }),
    User.countDocuments({ lastLogin: { $gte: prev7Start, $lt: last7Start } }),
  ])

  res.json({
    success: true,
    message: 'Admin stats fetched successfully',
    data: {
      totalUsers,
      totalPatients,
      totalDoctors,
      totalAdmins,
      totalRecords,
      totalAppointments,
      pendingDoctors,
      activeToday,
      userTrend:   percentChange(newUsersLast7, newUsersPrev7),
      activeTrend: percentChange(activeLast7, activePrev7),
    },
  })
}

// ─── USERS ─────────────────────────────────────────────────
const getUsers = async (req, res) => {
  const { role, status, search, page = 1, limit = 20, isApproved } = req.query

  const filter = {}
  if (role)   filter.role   = role
  if (status) filter.status = status
  if (isApproved !== undefined) filter.isApproved = isApproved === 'true'
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)
  const [users, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    User.countDocuments(filter),
  ])

  res.json({
    success: true,
    message: 'Users fetched successfully',
    data: { users, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) },
  })
}

const getUser = async (req, res) => {
  const user = await User.findById(req.params.id).select('-password')
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

  const [recordCount, appointmentCount] = await Promise.all([
    HealthRecord.countDocuments({ patient: user._id }),
    Appointment.countDocuments({ $or: [{ patient: user._id }, { doctor: user._id }] }),
  ])

  res.json({
    success: true,
    message: 'User fetched',
    data: { user: user.toSafeObject(), recordCount, appointmentCount },
  })
}

const createUser = async (req, res) => {
  const { name, email, password, role = 'patient', phone, specialization, licenseNumber } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email and password are required.' })
  }

  const existing = await User.findOne({ email })
  if (existing) return res.status(409).json({ success: false, message: 'Email already in use.' })

  const user = await User.create({
    name, email, password, role, phone,
    specialization, licenseNumber,
    isApproved: true,   // Admin-created users are auto-approved
    status: 'active',
  })

  await writeAuditLog({
    user:       req.user._id,
    action:     'USER_CREATED',
    resource:   'User',
    resourceId: user._id,
    details:    { createdRole: role },
    ip:         req.ip,
  })

  res.status(201).json({ success: true, message: 'User created successfully', data: { user: user.toSafeObject() } })
}

const updateUser = async (req, res) => {
  const forbidden = ['password', 'email']
  forbidden.forEach(f => delete req.body[f])

  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password')
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

  await writeAuditLog({
    user: req.user._id, action: 'USER_UPDATED', resource: 'User', resourceId: user._id, ip: req.ip,
  })

  res.json({ success: true, message: 'User updated successfully', data: { user: user.toSafeObject() } })
}

const deleteUser = async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' })
  }

  const user = await User.findByIdAndDelete(req.params.id)
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

  await writeAuditLog({
    user: req.user._id, action: 'USER_DELETED', resource: 'User',
    details: { deletedEmail: user.email, deletedRole: user.role }, ip: req.ip,
  })

  res.json({ success: true, message: 'User deleted successfully', data: null })
}

const toggleUserStatus = async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot change your own status.' })
  }

  const user = await User.findById(req.params.id).select('-password')
  if (!user) return res.status(404).json({ success: false, message: 'User not found.' })

  user.status = user.status === 'active' ? 'suspended' : 'active'
  await user.save({ validateBeforeSave: false })

  await writeAuditLog({
    user: req.user._id, action: 'USER_STATUS_TOGGLED', resource: 'User',
    resourceId: user._id, details: { newStatus: user.status }, ip: req.ip,
  })

  res.json({ success: true, message: `User status set to ${user.status}`, data: { user: user.toSafeObject() } })
}

// ─── DOCTOR APPROVAL ───────────────────────────────────────
const getDoctors = async (req, res) => {
  const { isApproved, page = 1, limit = 20 } = req.query
  const filter = { role: 'doctor' }
  // Query params are always strings; accept true/false explicitly (axios may omit boolean false from URLs)
  if (isApproved !== undefined && isApproved !== '') {
    const v = String(isApproved).toLowerCase()
    if (v === 'true' || v === 'false') filter.isApproved = v === 'true'
  }

  const skip = (parseInt(page) - 1) * parseInt(limit)
  const [doctors, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    User.countDocuments(filter),
  ])

  res.json({ success: true, message: 'Doctors fetched', data: { doctors, total } })
}

const approveDoctor = async (req, res) => {
  const doctor = await User.findOne({ _id: req.params.id, role: 'doctor' }).select('-password')
  if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found.' })

  const approve = req.body.approve !== false
  const wasApproved = doctor.isApproved
  doctor.isApproved = approve
  doctor.status     = approve ? 'active' : 'inactive'
  await doctor.save({ validateBeforeSave: false })

  await writeAuditLog({
    user: req.user._id,
    action: approve ? 'DOCTOR_APPROVED' : 'DOCTOR_REJECTED',
    resource: 'User', resourceId: doctor._id, ip: req.ip,
  })

  if (approve && !wasApproved) {
    try {
      await sendDoctorApprovalEmail(doctor)
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Doctor approval email failed:', err.message)
      }
    }
  }

  res.json({
    success: true,
    message: `Doctor ${approve ? 'approved' : 'rejected'} successfully`,
    data: { doctor: doctor.toSafeObject() },
  })
}

// ─── PATIENTS list for admin ────────────────────────────────
const getPatients = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query
  const filter = { role: 'patient' }
  if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]

  const skip = (parseInt(page) - 1) * parseInt(limit)
  const [patients, total] = await Promise.all([
    User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    User.countDocuments(filter),
  ])

  res.json({ success: true, message: 'Patients fetched', data: { patients, total } })
}

// ─── AUDIT LOGS ────────────────────────────────────────────
const getAuditLogs = async (req, res) => {
  const { action, page = 1, limit = 30 } = req.query
  const filter = {}
  if (action) filter.action = action

  const skip = (parseInt(page) - 1) * parseInt(limit)
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user', 'name email role'),
    AuditLog.countDocuments(filter),
  ])

  res.json({ success: true, message: 'Audit logs fetched', data: { logs, total, page: parseInt(page) } })
}

// ─── SYSTEM HEALTH ─────────────────────────────────────────
const getSystemHealth = async (req, res) => {
  const uptimeSecs = process.uptime()
  const hours      = Math.floor(uptimeSecs / 3600)
  const mins       = Math.floor((uptimeSecs % 3600) / 60)
  const memUsage   = process.memoryUsage()
  const totalMem   = os.totalmem()
  const freeMem    = os.freemem()
  const usedMemPct = (((totalMem - freeMem) / totalMem) * 100).toFixed(1)

  const mongoose   = require('mongoose')
  const dbState    = ['disconnected', 'connected', 'connecting', 'disconnecting']

  const lastBackup = process.env.LAST_BACKUP_AT || process.env.BACKUP_LAST_AT || null

  res.json({
    success: true,
    message: 'System health fetched',
    data: {
      apiStatus:   'online',
      dbStatus:    dbState[mongoose.connection.readyState] || 'unknown',
      uptime:      `${hours}h ${mins}m`,
      memoryUsage: `${usedMemPct}%`,
      diskSpace:   getDiskSpaceLabel(),
      lastBackup,
      checkedAt:   new Date().toISOString(),
      nodeVersion: process.version,
      platform:    os.platform(),
      cpus:        os.cpus().length,
      heapUsed:    `${(memUsage.heapUsed / 1024 / 1024).toFixed(1)} MB`,
    },
  })
}

module.exports = {
  getStats,
  getUsers, getUser, createUser, updateUser, deleteUser, toggleUserStatus,
  getDoctors, approveDoctor,
  getPatients,
  getAuditLogs,
  getSystemHealth,
}
