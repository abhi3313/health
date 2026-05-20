'use strict'

const Prescription = require('../models/Prescription')

function normalizeMedicineName(name = '') {
  return String(name).trim().toLowerCase().replace(/\s+/g, ' ')
}

function formatMedicine(med = {}, prescription = {}) {
  return {
    name: med.name || '',
    dosage: med.dosage || '',
    frequency: med.frequency || '',
    duration: med.duration || '',
    route: med.route || '',
    instructions: med.instructions || '',
    diagnosis: prescription.diagnosis || '',
    prescriptionId: prescription._id,
    prescribedAt: prescription.createdAt,
    status: prescription.status,
  }
}

async function fetchPrescriptionData(userId, options = {}) {
  if (!userId) return []

  const limit = Math.min(Math.max(Number(options.limit) || 8, 1), 20)
  return Prescription.find({ patient: userId })
    .sort({ status: 1, createdAt: -1 })
    .limit(limit)
    .populate('doctor', 'name specialization')
    .lean()
}

async function fetchCurrentMedicines(userId) {
  const prescriptions = await fetchPrescriptionData(userId, { limit: 12 })
  const now = new Date()

  return prescriptions
    .filter(rx => {
      if (rx.status !== 'active') return false
      if (rx.validUntil && new Date(rx.validUntil) < now) return false
      return true
    })
    .flatMap(rx => (rx.medications || []).map(med => formatMedicine(med, rx)))
    .filter(med => med.name)
}

function analyzePrescriptionData(prescriptions = []) {
  const active = prescriptions.filter(rx => rx.status === 'active')
  const latest = prescriptions[0] || null
  const activeMedicines = active.flatMap(rx => rx.medications || [])

  return {
    totalPrescriptions: prescriptions.length,
    activePrescriptions: active.length,
    activeMedicineCount: activeMedicines.length,
    latestDiagnosis: latest?.diagnosis || '',
    latestInstructions: latest?.instructions || '',
    hasRecentPrescription: Boolean(latest),
  }
}

module.exports = {
  analyzePrescriptionData,
  fetchCurrentMedicines,
  fetchPrescriptionData,
  normalizeMedicineName,
}
