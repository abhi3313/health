const mongoose = require('mongoose')

const healthRecordSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Patient is required'],
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    type: {
      type: String,
      required: [true, 'Record type is required'],
      enum: [
        'Lab Report',
        'Prescription',
        'X-Ray',
        'MRI Scan',
        'CT Scan',
        'Blood Test',
        'ECG',
        'Ultrasound',
        'Vaccination',
        'General Checkup',
        'Other',
      ],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'pending'],
      default: 'active',
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical', ''],
      default: '',
    },

    // Attachments
    attachments: [
      {
        filename:     { type: String },
        originalName: { type: String },
        mimetype:     { type: String },
        size:         { type: Number },
        url:          { type: String },
        uploadedAt:   { type: Date, default: Date.now },
      },
    ],

    // Diagnosis & treatment
    diagnosis:  { type: String, default: '' },
    treatment:  { type: String, default: '' },
    followUpDate: { type: Date },

    // Lab values (key-value pairs for flexibility)
    labValues: [
      {
        name:   { type: String },
        value:  { type: String },
        unit:   { type: String },
        normal: { type: String },
        flag:   { type: String, enum: ['normal', 'high', 'low', 'critical', ''], default: '' },
      },
    ],

    tags: [{ type: String }],
    isSharedWithDoctor: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

healthRecordSchema.index({ patient: 1, createdAt: -1 })
healthRecordSchema.index({ patient: 1, type: 1 })
healthRecordSchema.index({ doctor: 1 })

module.exports = mongoose.model('HealthRecord', healthRecordSchema)
