const pinoHttp = require("pino-http");
const { env } = require("../config/env");

function requestLogger() {
  return pinoHttp({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
        "req.body.password",
        "req.body.currentPassword",
        "req.body.newPassword",
        "req.body.token",
        "req.body.refreshToken",
      ],
      remove: true,
    },
    customProps: (req) => ({
      requestId: req.id,
    }),
  });
}

module.exports = { requestLogger };
