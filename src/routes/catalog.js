const express = require("express");
const router = express.Router();

const { authJwt } = require("../middleware/authJwt");
const { asyncHandler } = require("../utils/asyncHandler");
const { validateQuery } = require("../middleware/validate");
const {
  listInstitutions,
  listEstablishments,
  listDependencies,
  listAssetStates,
  listAssetTypes,
  listCatalogCategories,
  listCatalogItems,
} = require("../services/catalogService");
const {
  institutionsQuery,
  establishmentsQuery,
  dependenciesQuery,
  assetTypesQuery,
  assetStatesQuery,
  categoriesQuery,
  catalogItemsQuery,
} = require("../validators/catalogSchemas");

router.use(authJwt);

router.get(
  "/institutions",
  validateQuery(institutionsQuery),
  asyncHandler(async (req, res) => {
    const result = await listInstitutions(req.user, req.query);
    res.json(result);
  })
);

router.get(
  "/establishments",
  validateQuery(establishmentsQuery),
  asyncHandler(async (req, res) => {
    const result = await listEstablishments(req.user, req.query);
    res.json(result);
  })
);

router.get(
  "/dependencies",
  validateQuery(dependenciesQuery),
  asyncHandler(async (req, res) => {
    const result = await listDependencies(req.user, req.query);
    res.json(result);
  })
);

router.get(
  "/categories",
  validateQuery(categoriesQuery),
  asyncHandler(async (req, res) => {
    const result = await listCatalogCategories(req.query);
    res.json(result);
  })
);

router.get(
  "/items",
  validateQuery(catalogItemsQuery),
  asyncHandler(async (req, res) => {
    const result = await listCatalogItems(req.query);
    res.json(result);
  })
);

router.get(
  "/asset-states",
  validateQuery(assetStatesQuery),
  asyncHandler(async (req, res) => {
    const result = await listAssetStates(req.query);
    res.json(result);
  })
);

router.get(
  "/asset-types",
  validateQuery(assetTypesQuery),
  asyncHandler(async (req, res) => {
    const result = await listAssetTypes(req.query);
    res.json(result);
  })
);

module.exports = { catalogRouter: router };
