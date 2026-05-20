'use strict'

const HealthRecord = require('../models/HealthRecord')
const Report       = require('../models/Report')
const Vital        = require('../models/Vital')

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'anything', 'because', 'before', 'could', 'health',
  'medicine', 'medicines', 'medical', 'please', 'should', 'started', 'today',
  'what', 'when', 'where', 'which', 'with', 'would', 'your',
])

function cleanText(value = '', maxLength = 600) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function dateOnly(date) {
  if (!date) return ''
  return new Date(date).toISOString().slice(0, 10)
}

function getQueryTerms(message = '') {
  return String(message)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map(term => term.trim())
    .filter(term => term.length >= 4 && !STOP_WORDS.has(term))
}

function recordSearchText(record = {}) {
  return [
    record.type,
    record.description,
    record.notes,
    record.diagnosis,
    record.treatment,
    ...(record.tags || []),
    ...(record.labValues || []).map(lab => `${lab.name} ${lab.value} ${lab.flag}`),
  ].join(' ').toLowerCase()
}

function relevanceScore(record, terms = []) {
  const text = recordSearchText(record)
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0)
}

async function fetchMedicalRecords(userId, message = '', options = {}) {
  if (!userId) {
    return { records: [], vitals: [], reports: [] }
  }

  const recordLimit = Math.min(Math.max(Number(options.recordLimit) || 10, 1), 30)
  const terms = getQueryTerms(message)

  const [records, vitals, reports] = await Promise.all([
    HealthRecord.find({ patient: userId, status: { $ne: 'archived' } })
      .sort({ createdAt: -1 })
      .limit(recordLimit)
      .populate('doctor', 'name specialization')
      .lean(),
    Vital.find({ patient: userId }).sort({ recordedAt: -1 }).limit(5).lean(),
    Report.find({ patient: userId, isArchived: false }).sort({ createdAt: -1 }).limit(5).lean(),
  ])

  const scoredRecords = records
    .map(record => ({ record, score: relevanceScore(record, terms) }))
    .sort((a, b) => b.score - a.score || new Date(b.record.createdAt) - new Date(a.record.createdAt))
    .map(item => item.record)

  return {
    records: scoredRecords,
    vitals,
    reports,
  }
}

function summarizeVital(vital = {}) {
  const values = []
  if (vital.bloodPressure?.systolic) {
    values.push(`BP ${vital.bloodPressure.systolic}/${vital.bloodPressure.diastolic} ${vital.bloodPressure.unit || ''} ${vital.bloodPressure.flag || ''}`.trim())
  }
  if (vital.heartRate?.value) values.push(`HR ${vital.heartRate.value} ${vital.heartRate.unit || ''} ${vital.heartRate.flag || ''}`.trim())
  if (vital.temperature?.value) values.push(`Temp ${vital.temperature.value} ${vital.temperature.unit || ''} ${vital.temperature.flag || ''}`.trim())
  if (vital.oxygenSaturation?.value) values.push(`O2 ${vital.oxygenSaturation.value}${vital.oxygenSaturation.unit || ''} ${vital.oxygenSaturation.flag || ''}`.trim())
  if (vital.glucose?.value) values.push(`Glucose ${vital.glucose.value} ${vital.glucose.unit || ''} ${vital.glucose.type || ''} ${vital.glucose.flag || ''}`.trim())
  if (vital.bmi) values.push(`BMI ${vital.bmi}`)
  return values.join('; ')
}

function analyzeMedicalHistory(profile = {}, medicalRecords = {}) {
  const records = medicalRecords.records || []
  const vitals = medicalRecords.vitals || []
  const reports = medicalRecords.reports || []

  const flaggedLabs = records.flatMap(record =>
    (record.labValues || [])
      .filter(lab => lab.flag && lab.flag !== 'normal')
      .map(lab => ({
        recordType: record.type,
        name: lab.name,
        value: lab.value,
        unit: lab.unit,
        flag: lab.flag,
        date: dateOnly(record.date || record.createdAt),
      })),
  )

  const importantRecords = records.filter(record =>
    ['high', 'critical'].includes(record.severity) || record.diagnosis || record.treatment,
  )

  return {
    chronicConditions: profile.chronicConditions || [],
    recentRecords: records.slice(0, 6).map(record => ({
      type: record.type,
      date: dateOnly(record.date || record.createdAt),
      severity: record.severity || '',
      description: cleanText(record.description, 300),
      diagnosis: cleanText(record.diagnosis, 200),
      treatment: cleanText(record.treatment, 200),
    })),
    importantRecords: importantRecords.slice(0, 5).map(record => ({
      type: record.type,
      date: dateOnly(record.date || record.createdAt),
      severity: record.severity || '',
      diagnosis: cleanText(record.diagnosis, 200),
      treatment: cleanText(record.treatment, 200),
    })),
    flaggedLabs: flaggedLabs.slice(0, 8),
    latestVitals: vitals[0] ? {
      date: dateOnly(vitals[0].recordedAt || vitals[0].createdAt),
      summary: summarizeVital(vitals[0]),
    } : null,
    recentReports: reports.slice(0, 5).map(report => ({
      tag: report.tag,
      category: report.category,
      date: dateOnly(report.createdAt),
      description: cleanText(report.description, 200),
      aiSummary: cleanText(report.aiSummary, 300),
    })),
  }
}

module.exports = {
  analyzeMedicalHistory,
  cleanText,
  dateOnly,
  fetchMedicalRecords,
  getQueryTerms,
}
