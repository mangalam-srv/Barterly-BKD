import dotenv from "dotenv";
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import connectDB from "./db/index.js";
import app from "./app.js";

// ✅ Load environment variables
dotenv.config({ path: "./.env", override: true });

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";

console.log(`🚀 Starting server in ${NODE_ENV} mode on port ${PORT}`);

// ✅ Validate required environment variables
const requiredEnvVars = ["MONGODB_URI"];
const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(
    "❌ Missing required environment variables:",
    missingEnvVars.join(", ")
  );
  process.exit(1);
}

// ✅ Create HTTP server for Express + WebSocket
const server = http.createServer(app);

// ✅ Setup WebSocket server
const wss = new WebSocketServer({ server, perMessageDeflate: false });

// ✅ WebSocket connection handler
wss.on("connection", (ws) => {
  console.log(
    "✅ WebSocket client connected. Total clients:",
    wss.clients.size
  );

  // ✅ Handle incoming messages
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      console.log("📩 Received:", data.event);

      // ✅ Handle joining a room
      if (data.event === "join-room") {
        ws.roomId = data.data;
        ws.send(
          JSON.stringify({
            event: "joined",
            room: data.data,
            message: `You joined room ${data.data}`,
          })
        );
        console.log(`👤 User joined room: ${data.data}`);
      }

      // ✅ Handle sending a message
      if (data.event === "send-message") {
        const { roomId, message, sender } = data.data;

        // ✅ Broadcast to all clients in the same room
        wss.clients.forEach((client) => {
          if (
            client.readyState === 1 && // WebSocket.OPEN
            client.roomId === roomId
          ) {
            client.send(
              JSON.stringify({
                event: "receive-message",
                roomId,
                message,
                sender,
                timestamp: new Date().toISOString(),
              })
            );
          }
        });
        console.log(`💬 Message sent in room: ${roomId}`);
      }
    } catch (err) {
      console.error("❌ Invalid WebSocket message:", err);
      ws.send(
        JSON.stringify({
          event: "error",
          error: "Invalid JSON format",
        })
      );
    }
  });

  // ✅ Handle client disconnect
  ws.on("close", () => {
    console.log(
      "❌ WebSocket client disconnected. Remaining clients:",
      wss.clients.size
    );
  });

  // ✅ Handle WebSocket errors
  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err.message);
  });
});

// ✅ Connect to MongoDB and start server
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ Server is running on http://localhost:${PORT}`);
      console.log(`✅ WebSocket server is ready for connections`);
      console.log(`✅ API documentation: http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  });

// ✅ Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

// ✅ Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

// ✅ Graceful shutdown
process.on("SIGTERM", () => {
  console.log("📛 SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("✅ HTTP server closed");
    process.exit(0);
  });
});
