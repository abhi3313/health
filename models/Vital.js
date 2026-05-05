const mongoose = require('mongoose')

const vitalSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    heartRate: {
      value: { type: Number },
      unit:  { type: String, default: 'bpm' },
      flag:  { type: String, enum: ['normal', 'high', 'low', ''], default: '' },
    },
    bloodPressure: {
      systolic:  { type: Number },
      diastolic: { type: Number },
      unit:  { type: String, default: 'mmHg' },
      flag:  { type: String, enum: ['normal', 'high', 'low', 'hypertensive', ''], default: '' },
    },
    temperature: {
      value: { type: Number },
      unit:  { type: String, default: '°F' },
      flag:  { type: String, enum: ['normal', 'fever', 'hypothermia', ''], default: '' },
    },
    oxygenSaturation: {
      value: { type: Number },
      unit:  { type: String, default: '%' },
      flag:  { type: String, enum: ['normal', 'low', 'critical', ''], default: '' },
    },
    glucose: {
      value: { type: Number },
      unit:  { type: String, default: 'mg/dL' },
      type:  { type: String, enum: ['fasting', 'post-meal', 'random', ''], default: '' },
      flag:  { type: String, enum: ['normal', 'high', 'low', ''], default: '' },
    },
    weight: {
      value: { type: Number },
      unit:  { type: String, default: 'kg' },
    },
    height: {
      value: { type: Number },
      unit:  { type: String, default: 'cm' },
    },
    bmi:   { type: Number },
    notes: { type: String, default: '' },
    recordedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

// Auto-compute BMI
vitalSchema.pre('save', function (next) {
  if (this.weight?.value && this.height?.value) {
    const hMeters = this.height.value / 100
    this.bmi = parseFloat((this.weight.value / (hMeters * hMeters)).toFixed(1))
  }
  // Auto-flag heart rate
  if (this.heartRate?.value) {
    const hr = this.heartRate.value
    this.heartRate.flag = hr < 60 ? 'low' : hr > 100 ? 'high' : 'normal'
  }
  // Auto-flag oxygen
  if (this.oxygenSaturation?.value) {
    const o2 = this.oxygenSaturation.value
    this.oxygenSaturation.flag = o2 < 90 ? 'critical' : o2 < 95 ? 'low' : 'normal'
  }
  // Auto-flag temperature
  if (this.temperature?.value) {
    const t = this.temperature.value
    this.temperature.flag = t < 96 ? 'hypothermia' : t > 99.5 ? 'fever' : 'normal'
  }
  next()
})

vitalSchema.index({ patient: 1, recordedAt: -1 })

module.exports = mongoose.model('Vital', vitalSchema)
