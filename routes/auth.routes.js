import { Router } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";

const router = Router();

// Trigger Google login
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Google callback
router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      const profile = req.user;

      // Extract email & name
      const email = profile.emails[0].value;
      const name = profile.displayName;

      // Check if user exists
      let user = await User.findOne({ email });

      if (!user) {
        // Create new user (password not needed for Google login)
        user = await User.create({
          name,
          email,
          password: "google-oauth", // dummy password (or leave undefined if schema allows)
        });
      }

      // Generate JWT token
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

      // Send token + user info
      return res.json({
        success: true,
        user: { id: user._id, name: user.name, email: user.email },
        token,
      });

    } catch (error) {
      console.error(error);
      res.redirect("/login?error=OAuthFailed");
    }
  }
);

export default router;
