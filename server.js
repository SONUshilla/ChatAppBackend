import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Handle joining a room
  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
    socket.to(room).emit("joined-room", { id: socket.id });

  });

  socket.on("call-user",(data)=>{
    const {id,offer}=data;
    io.to(id).emit("incoming-call",{id:socket.id , offer});
  });
  socket.on("call-accepted",(data)=>{
    const {id,ans}=data;
    io.to(id).emit("call-accepted",{ans});
  });

  // Handle messages in a room
  socket.on("sendMessage", ({ room, message }) => {
    io.to(room).emit("message", message);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
