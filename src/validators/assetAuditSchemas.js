const { z } = require("zod");

const assetAuditQuery = z.object({
  assetId: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  action: z.enum(["CREATE", "RELOCATE", "STATUS_CHANGE"]).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

module.exports = { assetAuditQuery };
