const mongoose = require('mongoose')
const Appointment = require('../models/Appointment')
const AccessRequest = require('../models/AccessRequest')

function toOid(id) {
  if (id == null) return id
  const s = String(id)
  return mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : id
}

function isApprovedAccessActive(r) {
  if (!r || r.status !== 'approved') return false
  if (r.expiresAt && new Date() > new Date(r.expiresAt)) return false
  return true
}

/**
 * Doctor may manage patient only if they share an appointment or approved non-expired access.
 * @returns {Promise<{ code: number, message: string } | null>} null = allowed
 */
async function assertDoctorCanManagePatient(doctorId, patientId) {
  const docRef = toOid(doctorId)
  const patRef = toOid(patientId)

  const [apt, access] = await Promise.all([
    Appointment.findOne({ doctor: docRef, patient: patRef }).select('_id').lean(),
    AccessRequest.findOne({ doctor: docRef, patient: patRef, status: 'approved' })
      .select('expiresAt status')
      .lean(),
  ])

  if (apt) return null
  if (access && isApprovedAccessActive(access)) return null

  return {
    code: 403,
    message: 'You do not have permission to add clinical data for this patient. They need an appointment with you or approved access.',
  }
}

module.exports = { assertDoctorCanManagePatient, toOid }
