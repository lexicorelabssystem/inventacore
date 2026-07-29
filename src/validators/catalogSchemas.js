const { z } = require("zod");
const { booleanLike } = require("./boolean");

const pagination = z.object({
  q: z.string().optional(),
  includeInactive: booleanLike,
  take: z.coerce.number().int().min(1).max(100).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const institutionsQuery = pagination;

const establishmentsQuery = pagination.extend({
  institutionId: z.coerce.number().int().positive().optional(),
});

const dependenciesQuery = pagination.extend({
  establishmentId: z.coerce.number().int().positive().optional(),
});

const assetTypesQuery = pagination;
const assetStatesQuery = pagination;
const categoriesQuery = z.object({
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(300).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});
const catalogItemsQuery = pagination.extend({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  modelName: z.string().optional(),
});

module.exports = {
  institutionsQuery,
  establishmentsQuery,
  dependenciesQuery,
  assetTypesQuery,
  assetStatesQuery,
  categoriesQuery,
  catalogItemsQuery,
};
