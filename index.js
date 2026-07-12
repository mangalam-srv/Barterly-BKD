import dns from "dns";
dns.setServers(["8.8.8.8", "8.8.4.4"]);
import dotenv from "dotenv";


import express from "express";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./db/index.js";
import app from "./app.js";
import Conversation from "./models/conversation.models.js";
import Message from "./models/message.models.js";

const PORT = process.env.PORT || 4000;

// Create HTTP server for Express + WS
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  },
});

io.on("connection", (socket) => {
  

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    
  });

  socket.on("typing", (roomId) => {
    socket.to(roomId).emit("typing");
  });

  socket.on("disconnect", () => {
    
  });
});

app.set("io", io);

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
