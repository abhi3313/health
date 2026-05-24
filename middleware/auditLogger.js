const { writeAuditLog } = require('../utils/audit')

const auditLogger = (action, resource) => {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          await writeAuditLog({
            user:       req.user?._id,
            action,
            resource,
            resourceId: req.params?.id,
            details:    { method: req.method, path: req.path },
            ip:         req.ip || req.connection?.remoteAddress,
            userAgent:  req.headers['user-agent'],
          })
        } catch (_) { /* non-blocking */ }
      }
    })
    next()
  }
}

module.exports = auditLogger
