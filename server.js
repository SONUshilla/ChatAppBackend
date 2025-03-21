import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});
let waitingSocket = null;
let waitingVideoSocket = null;
let totalUsers = 0; // Track total connected users

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);
  totalUsers++;
  io.emit("updateTotalUsers", totalUsers);
  socket.on("joinChatRoom", () => {
    if (!waitingSocket) {
      // No user waiting, set this socket as the waiting one
      waitingSocket = socket;
      console.log("1");
      setTimeout(() => {
        socket.emit("waiting");
      }, 10);
    } else {
      if(waitingSocket===socket)
        {
            socket.emit("waiting");
        }
        else{
      // A user is waiting, create a new room for the pair
      const room = `room-${socket.id}-${waitingSocket.id}`;
      console.log("109");
      // Join both sockets to the same room
      socket.join(room);
      waitingSocket.join(room);
      setTimeout(() => {
        io.to(room).emit("chatRoomJoined", { room });
        io.to(room).emit("notification", { message: "A new user has joined the chat!" });
      }, 100);

      // Reset waiting socket
      waitingSocket = null;
    }}
  });
  socket.on("joinVideoRoom", () => {
    if (!waitingVideoSocket) {
      // No user waiting, set this socket as the waiting one
      waitingVideoSocket = socket;
      setTimeout(() => {
        socket.emit("waiting");
      }, 10);
    } else {
      if(waitingVideoSocket===socket)
      {
          socket.emit("waiting");
      }
      else{
      // A user is waiting, create a new room for the pair
      const room = `room-${socket.id}-${waitingVideoSocket.id}`;
      console.log("109");
      // Join both sockets to the same room
      socket.join(room);
      waitingVideoSocket.join(room);
      waitingVideoSocket.emit("joined-room", { id: socket.id });
      setTimeout(() => {
        io.to(room).emit("roomJoined", { room });
        io.to(room).emit("notification", { message: "A new user has joined the chat!" });
      }, 100);
      waitingVideoSocket = null;
    }
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
  
  socket.on("sendVideoMessage", ({ room, message }) => {
    socket.to(room).emit("videoMessage", message);
  });
  
  socket.on("ice-candidate", ({ room,candidate}) => {
    // Broadcast the ICE candidate to the other peer
    socket.to(room).emit("ice-candidate", candidate);
  });

  // Server-side code (e.g., in your Socket.IO setup)
  socket.on("endChat", (room) => {
      socket.to(room).emit("partner-disconnected");
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
    totalUsers--;
    io.emit("updateTotalUsers", totalUsers);
    if (waitingSocket?.id === socket.id) waitingSocket = null;
    if (waitingVideoSocket?.id === socket.id) waitingVideoSocket = null;
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
