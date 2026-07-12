import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.models.js";
import "./env.js";

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
const isGoogleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);


if (isGoogleOAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
callbackURL:
process.env.GOOGLE_CALLBACK_URL ||
"http://localhost:4000/api/v1/auth/google/callback",
        passReqToCallback: false,
      },
  async (accessToken, refreshToken, profile, done) => {
    try {
        

        return done(null, profile);
    } catch (err) {
        return done(err, null);
    }
}
    )
  );
} else {
  console.warn(
    "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it."
  );
}



export { isGoogleOAuthConfigured };
