const mongoose = require('mongoose')

function getMongoUri() {
  return String(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/healthguardian')
    .trim()
    .replace(/^["']|["']$/g, '')
}

function maskMongoUri(uri) {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//***:***@')
}

function getConnectionHelp(error) {
  const message = error?.message || ''

  if (/Could not connect to any servers|Server selection timed out/i.test(message)) {
    return [
      'Atlas could not be reached from this machine.',
      'Check Atlas Network Access and add your current public IP address, or temporarily allow 0.0.0.0/0 for development only.',
    ].join(' ')
  }

  if (/authentication failed|bad auth/i.test(message)) {
    return 'MongoDB authentication failed. Check the database username/password and URL-encode special characters in the password.'
  }

  if (/querySrv|ENOTFOUND|ETIMEOUT/i.test(message)) {
    return 'MongoDB SRV lookup failed. Check your internet connection, DNS, cluster hostname, and whether your network blocks mongodb+srv DNS records.'
  }

  return ''
}

const connectDB = async () => {
  const mongoUri = getMongoUri()

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })

    console.log(` MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`)

    mongoose.connection.on('error', (err) => {
      console.error(` MongoDB Error: ${err.message}`)
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('   MongoDB disconnected. Retrying...')
    })

  } catch (error) {
    console.error(`  MongoDB Connection Failed: ${error.message}`)
    console.error(`  MongoDB URI: ${maskMongoUri(mongoUri)}`)

    const help = getConnectionHelp(error)
    if (help) {
      console.error(`  Fix: ${help}`)
    }

    process.exit(1)
  }
}

module.exports = connectDB
