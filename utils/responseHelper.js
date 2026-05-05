'use strict'

/**
 * Standardised JSON response helpers
 * All responses conform to: { success, message, data }
 */

const success = (res, data = null, message = 'Success', statusCode = 200) =>
  res.status(statusCode).json({ success: true, message, data })

const created = (res, data = null, message = 'Created successfully') =>
  success(res, data, message, 201)

const badRequest = (res, message = 'Bad request') =>
  res.status(400).json({ success: false, message, data: null })

const unauthorized = (res, message = 'Unauthorized') =>
  res.status(401).json({ success: false, message, data: null })

const forbidden = (res, message = 'Forbidden') =>
  res.status(403).json({ success: false, message, data: null })

const notFound = (res, message = 'Resource not found') =>
  res.status(404).json({ success: false, message, data: null })

const conflict = (res, message = 'Conflict') =>
  res.status(409).json({ success: false, message, data: null })

const unprocessable = (res, message = 'Validation failed', errors = []) =>
  res.status(422).json({ success: false, message, errors, data: null })

const serverError = (res, message = 'Internal server error') =>
  res.status(500).json({ success: false, message, data: null })

/**
 * Paginated response helper
 */
const paginated = (res, items, total, page, limit, message = 'Fetched successfully') =>
  res.json({
    success: true,
    message,
    data: {
      items,
      pagination: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        pages:      Math.ceil(total / parseInt(limit)),
        hasNext:    parseInt(page) * parseInt(limit) < total,
        hasPrev:    parseInt(page) > 1,
      },
    },
  })

module.exports = {
  success, created,
  badRequest, unauthorized, forbidden,
  notFound, conflict, unprocessable, serverError,
  paginated,
}
