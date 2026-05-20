const express = require('express')
const router  = express.Router()
const { body } = require('express-validator')

const {
  getDashboard, getStats,
  getPatients, getPatient, getPatientRecords, addPatientRecord,
  getPatientReports, uploadPatientReport,
  addNote,
  getAppointments, updateAppointment,
  getPatientPrescriptions, addPrescription,
} = require('../controllers/doctorController')

const { protect, authorize, requireApproved } = require('../middleware/auth')
const validate = require('../middleware/validate')
const upload = require('../config/multer')

// All doctor routes require auth + doctor role + approval
router.use(protect, authorize('doctor'), requireApproved)

// ── Dashboard ────────────────────────────────────────────
router.get('/dashboard', getDashboard)
router.get('/stats',     getStats)

// ── Patients ─────────────────────────────────────────────
router.get('/patients',       getPatients)
router.get('/patients/:id',   getPatient)

// Patient records (doctor view)
router.get('/patients/:id/records', getPatientRecords)
router.get('/patients/:id/reports', getPatientReports)
router.post('/patients/:id/reports/upload', upload.single('report'), uploadPatientReport)

const recordRules = [
  body('type').notEmpty().withMessage('Record type is required'),
  body('description').notEmpty().withMessage('Description is required'),
]
router.post('/patients/:id/records', recordRules, validate, addPatientRecord)

// Patient notes
const noteRules = [
  body('content').notEmpty().withMessage('Note content is required'),
]
router.post('/patients/:id/notes', noteRules, validate, addNote)

// ── Appointments ─────────────────────────────────────────
router.route('/appointments')
  .get(getAppointments)

router.route('/appointments/:id')
  .put(updateAppointment)

// ── Prescriptions ────────────────────────────────────────
const prescriptionRules = [
  body('diagnosis').notEmpty().withMessage('Diagnosis is required'),
  body('medications').isArray({ min: 1 }).withMessage('At least one medication is required'),
  body('medications.*.name').notEmpty().withMessage('Medication name is required'),
  body('medications.*.dosage').notEmpty().withMessage('Medication dosage is required'),
  body('medications.*.frequency').notEmpty().withMessage('Medication frequency is required'),
  body('medications.*.duration').notEmpty().withMessage('Medication duration is required'),
]

router.get('/patients/:id/prescriptions',  getPatientPrescriptions)
router.post('/patients/:id/prescriptions', prescriptionRules, validate, addPrescription)

module.exports = router
