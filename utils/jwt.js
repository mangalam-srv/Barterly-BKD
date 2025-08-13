import jwt from "jsonwebtoken";

export const signAccessToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || "7d" });
