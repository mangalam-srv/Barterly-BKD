// // middlewares/auth.middleware.js
// import jwt from "jsonwebtoken";
// import { ApiError } from "../utils/ApiError.js";
// import { asyncHandler } from "../utils/asyncHandler.js";
// import User from "../models/user.models.js";

// export const protect = asyncHandler(async (req, res, next) => {
//     const authHeader = req.headers.authorization || "";
//     const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

//     if (!token) {
//         throw new ApiError(401, "Unauthorized - No token provided");
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const user = await User.findById(decoded.userId).select("-password");

//     if (!user) {
//         throw new ApiError(401, "User not found");
//     }

//     req.user = user;
//     next();
// });
