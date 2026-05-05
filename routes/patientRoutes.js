const express = require('express')
const router  = express.Router()
const { body } = require('express-validator')

const {
  getDashboard, getStats,
  getRecords, getRecord, addRecord, updateRecord, deleteRecord,
  uploadReport, getReports, deleteReport,
  listDoctorsForBooking,
  getAppointments, bookAppointment, cancelAppointment,
  getVitals, addVital,
  getPrescriptions,
} = require('../controllers/patientController')

const { protect, authorize } = require('../middleware/auth')
const validate               = require('../middleware/validate')
const upload                 = require('../config/multer')

// All patient routes require auth + patient role
router.use(protect, authorize('patient'))

// ── Dashboard ────────────────────────────────────────────
router.get('/dashboard', getDashboard)
router.get('/stats',     getStats)

router.get('/doctors', listDoctorsForBooking)

// ── Health Records ───────────────────────────────────────
const recordRules = [
  body('type').notEmpty().withMessage('Record type is required'),
  body('description').notEmpty().withMessage('Description is required')
    .isLength({ max: 2000 }).withMessage('Description too long'),
]

router.route('/records')
  .get(getRecords)
  .post(recordRules, validate, addRecord)

router.route('/records/:id')
  .get(getRecord)
  .put(updateRecord)
  .delete(deleteRecord)

// ── Reports (file upload) ────────────────────────────────
router.post('/reports/upload', upload.single('report'), uploadReport)
router.get('/reports',                                  getReports)
router.delete('/reports/:id',                           deleteReport)

// ── Appointments ─────────────────────────────────────────
const appointmentRules = [
  body('doctorId').notEmpty().withMessage('Doctor ID is required'),
  body('date').isISO8601().withMessage('Valid date is required'),
  body('time').notEmpty().withMessage('Time is required'),
  body('reason').notEmpty().withMessage('Reason is required')
    .isLength({ max: 500 }).withMessage('Reason too long'),
]

router.route('/appointments')
  .get(getAppointments)
  .post(appointmentRules, validate, bookAppointment)

router.delete('/appointments/:id', cancelAppointment)

// ── Vitals ───────────────────────────────────────────────
router.route('/vitals')
  .get(getVitals)
  .post(addVital)

// ── Prescriptions ────────────────────────────────────────
router.get('/prescriptions', getPrescriptions)

module.exports = router
