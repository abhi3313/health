const jwt = require('jsonwebtoken')

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET
  if (!secret || String(secret).trim().length < 16) {
    throw new Error('JWT_SECRET is missing or too weak. Use at least 16 characters.')
  }
  return secret
}

const signAuthToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || '7d') => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn })
}

const verifyAuthToken = (token) => {
  return jwt.verify(token, getJwtSecret())
}

module.exports = {
  signAuthToken,
  verifyAuthToken,
}
