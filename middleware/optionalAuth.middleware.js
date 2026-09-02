// middleware/optionalAuth.middleware.js
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Attaches req.user when a valid Bearer token is present, but never rejects the
 * request when it is missing/invalid. Used by endpoints that are public but can
 * personalise / attribute when the caller happens to be logged in — mirrors the
 * public-but-auth-aware behaviour of the existing AI Compare endpoints.
 */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (user) req.user = user;
    } catch {
      // ignore — treat as anonymous
    }
  }

  next();
});
