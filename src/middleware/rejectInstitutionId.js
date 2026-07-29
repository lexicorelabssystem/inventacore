const { badRequest } = require("../utils/httpError");

function rejectInstitutionIdBody(req, res, next) {
  if (
    req.body &&
    Object.prototype.hasOwnProperty.call(req.body, "institutionId")
  ) {
    return next(badRequest("institutionId no permitido en este endpoint"));
  }
  return next();
}

module.exports = { rejectInstitutionIdBody };
