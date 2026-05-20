const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')
const { signAuthToken } = require('../utils/jwt')

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    oauthProvider: {
      type: String,
      default: '',
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'admin'],
      default: 'patient',
    },
    // Unique Patient ID – auto-generated for patient role (e.g. HG-P-AB12CD34)
    patientUniqueId: {
      type:   String,
      unique: true,
      sparse: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    isApproved: {
      type: Boolean,
      default: function () { return this.role !== 'doctor' },
    },

    // Patient-specific fields
    dateOfBirth: { type: Date },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', ''],
      default: '',
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', ''],
      default: '',
    },
    address: { type: String, default: '' },
    emergencyContact: {
      name:  { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    allergies: [{ type: String }],
    chronicConditions: [{ type: String }],

    // Doctor-specific fields
    specialization: { type: String, default: '' },
    licenseNumber:  { type: String, default: '' },
    experience:     { type: Number, default: 0 },
    qualifications: [{ type: String }],
    consultationFee:{ type: Number, default: 0 },
    hospital:       { type: String, default: '' },

    // Tracking
    lastLogin: { type: Date },
    loginCount:{ type: Number, default: 0 },

    passwordChangedAt: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
)

// ── Indexes ────────────────────────────────────────────────
userSchema.index({ role: 1, status: 1 })

// ── Virtuals ───────────────────────────────────────────────
userSchema.virtual('age').get(function () {
  if (!this.dateOfBirth) return null
  const diff = Date.now() - new Date(this.dateOfBirth).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25))
})

// ── Pre-save: hash password + generate patientUniqueId ────
userSchema.pre('save', async function (next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    if (!this.isNew) this.passwordChangedAt = Date.now() - 1000
  }
  // Auto-generate unique patient ID for new patient accounts
  if (this.isNew && this.role === 'patient' && !this.patientUniqueId) {
    const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const random = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
    this.patientUniqueId = `HG-P-${random(4)}-${random(4)}`
  }
  next()
})

// ── Methods ───────────────────────────────────────────────
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password)
}

userSchema.methods.generateToken = function () {
  return signAuthToken({ id: this._id, role: this.role })
}

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.password
  delete obj.passwordResetToken
  delete obj.passwordResetExpires
  delete obj.__v
  delete obj.googleId
  return obj
}

module.exports = mongoose.model('User', userSchema)
