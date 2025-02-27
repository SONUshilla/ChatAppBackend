import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
let waitingSocket = null;

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("joinChatRoom", () => {
    if (!waitingSocket) {
      // No user waiting, set this socket as the waiting one
      waitingSocket = socket;
      console.log("1");
      setTimeout(() => {
        socket.emit("waiting");
      }, 10);
    } else {
      // A user is waiting, create a new room for the pair
      const room = `room-${socket.id}-${waitingSocket.id}`;
      console.log("109");
      // Join both sockets to the same room
      socket.join(room);
      waitingSocket.join(room);
      setTimeout(() => {
        io.to(room).emit("roomJoined", { room });
        io.to(room).emit("notification", { message: "A new user has joined the chat!" });
      }, 100);

      // Reset waiting socket
      waitingSocket = null;
    }
  });
  socket.on("joinVideoRoom", () => {
    if (!waitingSocket) {
      // No user waiting, set this socket as the waiting one
      waitingSocket = socket;
      console.log("1");
      socket.emit("notification", "Waiting for another user to join...");
    } else {
      // A user is waiting, create a new room for the pair
      const room = `room-${socket.id}-${waitingSocket.id}`;
      console.log("109");
      // Join both sockets to the same room
      socket.join(room);
      waitingSocket.join(room);
      waitingSocket.emit("joined-room", { id: socket.id });
      setTimeout(() => {
        io.to(room).emit("roomJoined", { room });
        io.to(room).emit("notification", { message: "A new user has joined the chat!" });
      }, 100);
      waitingSocket = null;
    }
  });

  /* // Handle joining a room
  socket.on("joinRoom", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room ${room}`);
    socket.to(room).emit("joined-room", { id: socket.id });
  });*/

  socket.on("call-user", (data) => {
    const { id, offer } = data;
    io.to(id).emit("incoming-call", { id: socket.id, offer });
  });
  socket.on("call-accepted", (data) => {
    const { id, ans } = data;
    io.to(id).emit("call-accepted", { ans });
  });
  socket.on("nego-call-user", (data) => {
    const { id, offer } = data;
    io.to(id).emit("nego-incoming-call", { id: socket.id, offer });
  });
  socket.on("nego-call-accepted", (data) => {
    const { id, ans } = data;
    io.to(id).emit("nego-call-accepted", { ans });
  });

  // Handle messages in a room
  socket.on("sendMessage", ({ room, message }) => {
    socket.to(room).emit("message", message);
  });
  
  // Server-side code (e.g., in your Socket.IO setup)
  socket.on("endChat", (room) => {
    // Emit the event to all sockets in the room (excluding the sender)
    socket.to(room).emit("partner-disconnected");
  
    // Now leave the room
    socket.leave(room);
  });
  

  // Disconnection handling
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        socket.to(room).emit("partner-disconnected");   
      }
    });
  });

  socket.on("disconnect", () => {
    if (waitingSocket?.id === socket.id) waitingSocket = null;
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
