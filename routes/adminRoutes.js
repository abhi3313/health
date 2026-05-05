const express = require('express')
const router  = express.Router()
const { body } = require('express-validator')

const {
  getStats,
  getUsers, getUser, createUser, updateUser, deleteUser, toggleUserStatus,
  getDoctors, approveDoctor,
  getPatients,
  getAuditLogs,
  getSystemHealth,
} = require('../controllers/adminController')

const { protect, authorize } = require('../middleware/auth')
const validate               = require('../middleware/validate')

// All admin routes require auth + admin role
router.use(protect, authorize('admin'))

// ── Stats & System ───────────────────────────────────────
router.get('/stats',         getStats)
router.get('/system-health', getSystemHealth)
router.get('/logs',          getAuditLogs)

// ── Users ────────────────────────────────────────────────
const createUserRules = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['patient', 'doctor', 'admin']).withMessage('Invalid role'),
]

router.route('/users')
  .get(getUsers)
  .post(createUserRules, validate, createUser)

router.route('/users/:id')
  .get(getUser)
  .put(updateUser)
  .delete(deleteUser)

router.patch('/users/:id/toggle-status', toggleUserStatus)

// ── Doctors ──────────────────────────────────────────────
router.get('/doctors',              getDoctors)
router.patch('/doctors/:id/approve', approveDoctor)

// ── Patients ─────────────────────────────────────────────
router.get('/patients', getPatients)

module.exports = router
