require('dotenv').config()
const mongoose = require('mongoose')
const User = require('../models/User')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/healthguardian'

const required = (name) => {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const bootstrapAdmin = async () => {
  try {
    const name = process.env.ADMIN_NAME?.trim() || 'System Administrator'
    const email = required('ADMIN_EMAIL').toLowerCase()
    const password = required('ADMIN_PASSWORD')

    if (password.length < 8) {
      throw new Error('ADMIN_PASSWORD must be at least 8 characters')
    }

    await mongoose.connect(MONGO_URI)

    const existing = await User.findOne({ email })
    if (existing) {
      if (existing.role !== 'admin') {
        throw new Error(`A non-admin user already exists with ${email}`)
      }
      console.log(`Admin already exists: ${email}`)
      return
    }

    await User.create({
      name,
      email,
      password,
      role: 'admin',
      isApproved: true,
      status: 'active',
      emailVerified: true,
    })

    console.log(`Admin created: ${email}`)
  } catch (error) {
    console.error(`Admin bootstrap failed: ${error.message}`)
    process.exitCode = 1
  } finally {
    await mongoose.disconnect().catch(() => {})
  }
}

bootstrapAdmin()
