const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500
  let message    = err.message    || 'Internal Server Error'

  if (process.env.NODE_ENV === 'development') {
    console.error(' Error:', err)
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400
    message    = `Invalid ${err.path}: ${err.value}`
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyValue)[0]
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists.`
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 422
    message    = Object.values(err.errors).map(e => e.message).join(', ')
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401
    message    = 'Invalid token.'
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401
    message    = 'Session expired. Please login again.'
  }

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400
    message    = 'File too large. Maximum allowed size is 10 MB.'
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}

module.exports = errorHandler
