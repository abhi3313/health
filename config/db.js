const mongoose = require('mongoose')

const connectDB = async () => {
  try {
    
    const conn = await mongoose.connect("mongodb://localhost:27017/HealthGand", {
      serverSelectionTimeoutMS: 5000,
    })

    console.log(`✅  MongoDB Connected: ${conn.connection.host}`)

    mongoose.connection.on('error', (err) => {
      console.error(`❌  MongoDB Error: ${err.message}`)
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️   MongoDB disconnected. Retrying...')
    })

  } catch (error) {
    console.error(`❌  MongoDB Connection Failed: ${error.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
