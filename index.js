import dotenv from "dotenv";
import express from "express";
import http from "http";
import { WebSocketServer } from "ws";  // ✅ native ws
import connectDB from "./db/index.js";
import app from "./app.js";

dotenv.config({ path: './.env' }, { override: true });

const PORT = process.env.PORT || 4000;

// Create HTTP server for Express + WS
const server = http.createServer(app);

// Setup WebSocket server
const wss = new WebSocketServer({ server });

// When a client connects
wss.on("connection", (ws) => {
  console.log("✅ A client connected");

  // Handle messages from client
  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      console.log("📩 Received:", data);

      // Handle joining a room
      if (data.event === "join-room") {
        ws.roomId = data.data; // save room info
        ws.send(JSON.stringify({ 
          event: "joined", 
          room: data.data,
          message: `You joined room ${data.data}` 
        }));
      }

      // Handle sending a message
      if (data.event === "send-message") {
        // broadcast to all users in same room
        wss.clients.forEach((client) => {
          if (
            client.readyState === 1 && 
            client.roomId === data.data.roomId
          ) {
            client.send(JSON.stringify({
              event: "receive-message",
              roomId: data.data.roomId,
              message: data.data.message,
              sender: data.data.sender,
            }));
          }
        });
      }

    } catch (err) {
      console.error("❌ Invalid message", err);
      ws.send(JSON.stringify({ event: "error", error: "Invalid JSON" }));
    }
  });

  ws.on("close", () => {
    console.log("❌ Client disconnected");
  });
});

// Start server after DB connection
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Mongo DB connection failed", err);
  });
