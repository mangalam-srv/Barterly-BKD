// middlewares/auth.middleware.js
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.models.js";

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    throw new ApiError(401, "Unauthorized - No token provided");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ match your loginUser payload ({ id: user._id })
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    req.user = user;
    next();
  } catch (err) {
    throw new ApiError(401, "Unauthorized - Invalid or expired token");
  }
});
