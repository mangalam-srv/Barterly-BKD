import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const router = Router();

// ✅ Validate required environment variables
const validateGoogleAuth = () => {
  if (
    !process.env.GOOGLE_CLIENT_ID ||
    !process.env.GOOGLE_CLIENT_SECRET ||
    !process.env.JWT_SECRET
  ) {
    console.warn(
      "⚠️ Google OAuth not fully configured. Missing environment variables."
    );
    return false;
  }
  return true;
};

// ✅ Trigger Google login
router.get("/google", (req, res, next) => {
  if (!validateGoogleAuth()) {
    return res
      .status(503)
      .json(new ApiResponse(503, null, "Google OAuth service not configured"));
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(
    req,
    res,
    next
  );
});

// ✅ Google callback with error handling
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication failed");
    }

    try {
      const profile = req.user;

      // ✅ Extract and validate email & name
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;

      if (!email) {
        throw new ApiError(400, "Email not provided by Google");
      }

      // ✅ Check if user exists or create new user
      let user = await User.findOne({ email: email.toLowerCase() });

      if (!user) {
        user = await User.create({
          name: name || "Google User",
          email: email.toLowerCase(),
          googleId: profile.id,
          password: "oauth-google", // Dummy password for OAuth users
        });
      } else if (!user.googleId) {
        // Update existing user with googleId if not set
        user.googleId = profile.id;
        await user.save();
      }

      // ✅ Verify JWT_SECRET is configured
      if (!process.env.JWT_SECRET) {
        throw new ApiError(500, "Server configuration error");
      }

      // ✅ Generate JWT token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      // ✅ Prepare response data
      const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        location: user.location || "",
      };

      // ✅ Send JSON response (frontend will handle redirect)
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { user: userData, token },
            "Google login successful"
          )
        );
    } catch (error) {
      console.error("❌ Google OAuth callback error:", error);
      throw new ApiError(500, "OAuth callback failed: " + error.message);
    }
  })
);

export default router;
