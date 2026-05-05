const { validationResult } = require('express-validator')

const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: errors.array()[0].msg,
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    })
  }
  next()
}

module.exports = validate
