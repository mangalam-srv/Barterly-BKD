import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.models.js";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not configured");
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ✅ REGISTER USER
const registerUser = asyncHandler(async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    throw new ApiError(400, "Request body is missing");
  }

  const { name, email, password } = req.body;

  // ✅ Validate all required fields
  if (!name || !email || !password) {
    throw new ApiError(400, "Name, email, and password are required");
  }

  // ✅ Trim fields
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const trimmedPassword = password.trim();

  // ✅ Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    throw new ApiError(400, "Invalid email format");
  }

  // ✅ Validate password strength (minimum requirements)
  if (trimmedPassword.length < 6) {
    throw new ApiError(400, "Password must be at least 6 characters long");
  }

  // ✅ Check if user exists
  const existedUser = await User.findOne({ email: trimmedEmail });
  if (existedUser) {
    throw new ApiError(409, "Email already registered");
  }

  // ✅ Create user
  const user = await User.create({
    name: trimmedName,
    email: trimmedEmail,
    password: trimmedPassword,
  });

  // ✅ Fetch created user without password
  const createdUser = await User.findById(user._id).select("-password");
  if (!createdUser) {
    throw new ApiError(500, "Error creating user");
  }

  const token = generateToken(user._id);

  // ✅ Return 201 Created status
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        user: {
          id: createdUser._id,
          name: createdUser.name,
          email: createdUser.email,
          location: createdUser.location,
        },
        token,
      },
      "User registered successfully"
    )
  );
});

// ✅ LOGIN USER
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // ✅ Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const trimmedEmail = email.trim().toLowerCase();

  // ✅ Find user by email
  const user = await User.findOne({ email: trimmedEmail });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  // ✅ Compare passwords
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  // ✅ Generate token
  const token = generateToken(user._id);

  // ✅ Return 200 OK status
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          location: user.location,
        },
        token,
      },
      "Login successful"
    )
  );
});

// ✅ LOGOUT USER
const logoutUser = asyncHandler(async (req, res) => {
  // ✅ Clear token cookie if it exists
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "User logged out successfully"));
});

// ✅ GET CURRENT USER PROFILE
const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "User not authenticated");
  }

  const user = await User.findById(req.user._id).select("-password");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User profile retrieved successfully"));
});

// ✅ UPDATE USER PROFILE
const updateUserProfile = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "User not authenticated");
  }

  const { name, location } = req.body;

  // ✅ Validate input
  if (!name && !location) {
    throw new ApiError(
      400,
      "At least one field (name or location) is required"
    );
  }

  // ✅ Find and update user
  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (name) {
    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      throw new ApiError(400, "Name must be between 2 and 50 characters");
    }
    user.name = trimmedName;
  }

  if (location) {
    user.location = location.trim();
  }

  await user.save();

  const updatedUser = await User.findById(user._id).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "User profile updated successfully")
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateUserProfile,
};
