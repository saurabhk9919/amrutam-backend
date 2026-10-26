const crypto = require("crypto");

function requestIdMiddleware(req, res, next) {
  req.requestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}

module.exports = { requestIdMiddleware };
