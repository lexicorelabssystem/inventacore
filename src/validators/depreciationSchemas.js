const { z } = require("zod");

const depreciationRunCloseBody = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2200),
});

const depreciationRunListQuery = z.object({
  fiscalYear: z.coerce.number().int().min(2000).max(2200).optional(),
  take: z.coerce.number().int().min(1).max(20).optional(),
  skip: z.coerce.number().int().min(0).max(10000).optional(),
});

module.exports = {
  depreciationRunCloseBody,
  depreciationRunListQuery,
};
