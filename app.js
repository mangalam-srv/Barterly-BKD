import express from "express";
import cors from "cors";
import session from "express-session";
import passport from "passport";
import GoogleStrategy from "passport-google-oauth20";
import { ApiError } from "./utils/ApiError.js";

const app = express();

// ✅ Proper CORS configuration for frontend
const allowedOrigins = [
  "http://localhost:5173", // Vite dev server
  "http://localhost:3000",
  process.env.FRONTEND_URL || "http://localhost:5173",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// ✅ Session configuration with environment variable
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "your-secure-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

// ✅ Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:4000/auth/google/callback",
      },
      (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
      }
    )
  );
}

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ✅ Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "API is running" });
});

// ✅ Routes
import aiRoutes from "./routes/ai.routes.js";
app.use("/api/ai", aiRoutes);

import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter);

import itemRouter from "./routes/item.routes.js";
app.use("/api/v1/items", itemRouter);

import authRoutes from "./routes/auth.routes.js";
app.use("/auth", authRoutes);

// ✅ 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    path: req.originalUrl,
  });
});

// ✅ Global error handling middleware (MUST be last)
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);

  // Handle ApiError instances
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || [],
      statusCode: err.statusCode,
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
      statusCode: 401,
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
      statusCode: 401,
    });
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: Object.values(err.errors).map((e) => e.message),
      statusCode: 400,
    });
  }

  // Default server error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
    statusCode: err.statusCode || 500,
  });
});

export default app;
