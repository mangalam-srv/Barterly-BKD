// import dotenv from "dotenv";
// dotenv.config();
import "./config/env.js";

import express from "express";

const app = express();
import cors from "cors";
import passport from "passport";
import "./config/passport.js";


app.use("/api/v1/auth", authRoutes);

const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

app.set("trust proxy", 1);
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



app.use(passport.initialize());

import aiRoutes from "./routes/ai.routes.js";
app.use("/api/ai", aiRoutes);

import chatRoutes from "./routes/chat.routes.js";
app.use("/api/v1/chats", chatRoutes);

//import routes
import userRouter from "./routes/user.routes.js";
app.use("/api/v1/users", userRouter);

import itemRouter from "./routes/item.routes.js";
app.use("/api/v1/items", itemRouter);

import compareRoutes from "./routes/compare.routes.js";
app.use("/api/v1/compare", compareRoutes);

import advisorRoutes from "./routes/advisor.routes.js";
app.use("/api/v1/advisor", advisorRoutes);

// Internal API — only the Python AI service may call this (key- or loopback-gated).
import internalRoutes from "./routes/internal.routes.js";
app.use("/internal", internalRoutes);

import authRoutes from "./routes/auth.routes.js";
app.use("/api/v1/auth", authRoutes);

// Central error handler — keep last so it catches everything above.
import { errorHandler } from "./middleware/error.middleware.js";
app.use(errorHandler);

export default app;
