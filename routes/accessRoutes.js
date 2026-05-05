const express   = require('express')
const router    = express.Router()
const { body }  = require('express-validator')

const {
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
} = require('../controllers/accessController')

const { protect, authorize } = require('../middleware/auth')
const validate               = require('../middleware/validate')

// All routes require authentication
router.use(protect)

// ── Patient Routes ────────────────────────────────────────
// Patient: get their own unique patient ID
router.get('/patient-id', authorize('patient'), getMyPatientId)

// Patient: view incoming access requests (all statuses)
router.get('/incoming', authorize('patient'), getIncomingRequests)

// Patient: view all doctors (pending / approved / revoked)
router.get('/my-doctors', authorize('patient'), getMyDoctors)

// Patient: approve a pending request
router.patch('/requests/:id/approve', authorize('patient'), approveRequest)

// Patient: reject a pending request
router.patch('/requests/:id/reject', authorize('patient'), rejectRequest)

// Patient: revoke a previously approved request
router.patch('/requests/:id/revoke', authorize('patient'), revokeAccess)

// ── Doctor Routes ─────────────────────────────────────────
const requestRules = [
  body('patientUniqueId')
    .notEmpty().withMessage('Patient Unique ID is required')
    .trim()
    .toUpperCase(),
  body('requestMessage')
    .optional()
    .isLength({ max: 500 }).withMessage('Message cannot exceed 500 characters'),
]

// Doctor: send access request using patient unique ID
router.post('/request', authorize('doctor'), requestRules, validate, requestAccess)

// Doctor: view all requests they sent
router.get('/my-requests', authorize('doctor'), getDoctorRequests)

// Doctor: view all currently approved patients
router.get('/approved-patients', authorize('doctor'), getApprovedPatients)

// Doctor: withdraw a pending request
router.delete('/requests/:id', authorize('doctor'), withdrawRequest)

// Doctor: check if they have access to a specific patient
router.get('/check/:patientId', authorize('doctor'), checkAccess)

// Doctor: access approved patient's full data
router.get('/patients/:patientId/data', authorize('doctor'), getApprovedPatientRecords)

module.exports = router
