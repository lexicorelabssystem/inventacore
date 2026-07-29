const express = require("express");
const router = express.Router();
const { login, changeOwnPassword } = require("../services/authService");
const { asyncHandler } = require("../utils/asyncHandler");
const { validateBody } = require("../middleware/validate");
const { requireJson } = require("../middleware/requireJson");
const { loginBody, changePasswordBody } = require("../validators/authSchemas");
const { rotateRefreshToken, revokeRefreshToken } = require("../services/authTokensService");
const { env } = require("../config/env");
const { sendError } = require("../utils/errorResponse");
const { authJwt } = require("../middleware/authJwt");

function logAuthError(req, action, error) {
  console.error(`[auth:${action}] requestId=${req.id || "n/a"} method=${req.method} path=${req.originalUrl}`);
  console.error(error?.stack || error?.message || error);
}

router.post(
  "/login",
  requireJson,
  validateBody(loginBody),
  asyncHandler(async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await login(email, password, req.ip);
      const cookieOptions = {
        httpOnly: true,
        secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
        sameSite: env.COOKIE_SAMESITE,
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      };
      res.cookie("refresh_token", result.refreshToken, cookieOptions);
      res.json({ token: result.accessToken, user: result.user });
    } catch (error) {
      logAuthError(req, "login", error);
      throw error;
    }
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    try {
      const token = req.cookies?.refresh_token;
      if (!token) {
        return sendError(res, {
          status: 401,
          error: "Refresh token requerido",
          code: "REFRESH_TOKEN_REQUIRED",
          requestId: req.id,
        });
      }
      const rotated = await rotateRefreshToken(token);
      const cookieOptions = {
        httpOnly: true,
        secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
        sameSite: env.COOKIE_SAMESITE,
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      };
      res.cookie("refresh_token", rotated.refresh.raw, cookieOptions);
      res.json({ token: rotated.accessToken });
    } catch (error) {
      logAuthError(req, "refresh", error);
      throw error;
    }
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    try {
      const token = req.cookies?.refresh_token;
      if (token) await revokeRefreshToken(token);
      const cookieOptions = {
        httpOnly: true,
        secure: env.COOKIE_SECURE || env.NODE_ENV === "production",
        sameSite: env.COOKIE_SAMESITE,
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
      };
      res.clearCookie("refresh_token", cookieOptions);
      res.json({ ok: true });
    } catch (error) {
      logAuthError(req, "logout", error);
      throw error;
    }
  })
);

router.post(
  "/change-password",
  authJwt,
  requireJson,
  validateBody(changePasswordBody),
  asyncHandler(async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await changeOwnPassword(req.user.id, currentPassword, newPassword);
      res.json(result);
    } catch (error) {
      logAuthError(req, "change-password", error);
      throw error;
    }
  })
);

module.exports = { authRouter: router };
