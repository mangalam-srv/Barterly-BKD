// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.models.js";

// ✅ Protect route - verify JWT token
export const protect = asyncHandler(async (req, res, next) => {
  // ✅ Extract token from Authorization header
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Missing or invalid authorization header");
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token) {
    throw new ApiError(401, "Token is required");
  }

  // ✅ Verify JWT token
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "Server configuration error");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new ApiError(401, "Token has expired");
    }
    throw new ApiError(401, "Invalid token");
  }

  // ✅ Find user by decoded ID
  const user = await User.findById(decoded.id).select("-password");
  if (!user) {
    throw new ApiError(401, "User not found");
  }

  // ✅ Attach user to request
  req.user = user;
  next();
});
