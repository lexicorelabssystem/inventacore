function validateBody(schema) {
  return function validateBodyMiddleware(req, res, next) {
    const result = schema.safeParse(req.body);
    if (!result.success) return next(result.error);
    req.body = result.data;
    return next();
  };
}

function validateQuery(schema) {
  return function validateQueryMiddleware(req, res, next) {
    const result = schema.safeParse(req.query);
    if (!result.success) return next(result.error);
    req.query = result.data;
    return next();
  };
}

function validateParams(schema) {
  return function validateParamsMiddleware(req, res, next) {
    const result = schema.safeParse(req.params);
    if (!result.success) return next(result.error);
    req.params = result.data;
    return next();
  };
}

module.exports = { validateBody, validateQuery, validateParams };
