const mongoose = require('mongoose')

const reportSchema = new mongoose.Schema(
  {
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    tag: {
      type: String,
      default: 'Report',
      trim: true,
      maxlength: [100, 'Tag cannot exceed 100 characters'],
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      enum: ['lab', 'imaging', 'prescription', 'insurance', 'other'],
      default: 'other',
    },
    analyzedByAI: { type: Boolean, default: false },
    aiSummary:    { type: String, default: '' },
    isArchived:   { type: Boolean, default: false },
    sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
)

reportSchema.index({ patient: 1, createdAt: -1 })

module.exports = mongoose.model('Report', reportSchema)
