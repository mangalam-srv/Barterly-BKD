import { Router } from "express";
import passport from "passport";
import {
  completeGoogleLogin,
  getGoogleLoginFailure,
} from "../controllers/auth.controller.js";
import { isGoogleOAuthConfigured } from "../config/passport.js";

const router = Router();

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const googleOAuthUnavailable = (req, res) => {
  return res.redirect(
    `${clientUrl}/#/login?oauthError=google_oauth_not_configured`
  );
};

// Start Google OAuth
router.get(
  "/google",
  (req, res, next) => {

    if (!isGoogleOAuthConfigured) {
      console.warn("❌ Google OAuth not configured");
      return googleOAuthUnavailable(req, res);
    }

    next();
  },
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account",
  })
);

// Google callback
router.get(
  "/google/callback",
  (req, res, next) => {

    if (!isGoogleOAuthConfigured) {
      return googleOAuthUnavailable(req, res);
    }

    next();
  },
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${clientUrl}/#/login?oauthError=google_login_failed`,
  }),
  completeGoogleLogin
);

// Failure
router.get("/google/failure", getGoogleLoginFailure);

export default router;