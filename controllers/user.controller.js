import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.models.js";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// REGISTER USER
const registerUser = asyncHandler(async (req, res) => {
  if (!req.body) {
    throw new ApiError(400, "Request body is missing");
  }

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    throw new ApiError(400, "All fields are mandatory");
  }

  if (!email.includes("@")) {
    throw new ApiError(400, "Invalid email");
  }

  // Check if user exists
  const existedUser = await User.findOne({ email });
  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  // Create user
  const user = await User.create({ name, email, password });

  const createdUser = await User.findById(user._id).select("-password");
  if (!createdUser) {
    throw new ApiError(500, "Server issue while creating the user");
  }

  const token = generateToken(user._id);

  return res.status(201).json(
    new ApiResponse(
      200,
      { user: createdUser, token },
      "User registered successfully"
    )
  );
});

// LOGIN USER
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = generateToken(user._id);

  return res.status(200).json(
    new ApiResponse(
      200,
      { user: { id: user._id, name: user.name, email: user.email }, token },
      "Login successful"
    )
  );
});




// LOGOUT USER
const logoutUser = asyncHandler(async (req, res) => {
  // If you're storing the token in cookies
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true in production
    sameSite: "strict",
  });

  return res.status(200).json(
    new ApiResponse(200, null, "User logged out successfully")
  );
});

export { registerUser, loginUser ,logoutUser};
