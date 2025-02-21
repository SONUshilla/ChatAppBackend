import express from "express";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";

const app = express();
const server = createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: "*", // Allow CORS for development; adjust for production
  },
});

// Keep track of a waiting socket (if any)
let waitingSocket = null;

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Auto pairing logic for text chat (and video calls)
  if (waitingSocket) {
    // A user is waiting, so create a unique room name and pair them
    const roomName = `room-${waitingSocket.id}-${socket.id}`;
    waitingSocket.join(roomName);
    socket.join(roomName);

    // Notify both users they have been paired
    waitingSocket.emit("paired", { room: roomName });
    socket.emit("paired", { room: roomName });

    // Send a system notification event to all clients in the room
    io.in(roomName).emit("notification", {
      type: "paired",
      message: "Partner found.",
    });

    console.log(`Paired ${waitingSocket.id} and ${socket.id} in room ${roomName}`);

    // Clear the waiting socket variable
    waitingSocket = null;
  } else {
    // No one is waiting: mark this socket as waiting
    waitingSocket = socket;
    socket.emit("waiting", { message: "Waiting for a partner..." });
    console.log(`Socket ${socket.id} is waiting for a partner`);
  }

  // Handle text chat messages within a room
  socket.on("message", ({ room, message }) => {
    // Broadcast the message to the other user in the room
    socket.to(room).emit("message", message);
  });

  // Handle video call signaling events
  socket.on("video-offer", (data) => {
    // Forward the video offer (SDP) to the other peer in the room
    socket.to(data.room).emit("video-offer", {
      sdp: data.sdp,
      sender: socket.id,
    });
    console.log(`Video offer from ${socket.id} forwarded in room ${data.room}`);
  });

  socket.on("video-answer", (data) => {
    // Forward the video answer (SDP) to the other peer in the room
    socket.to(data.room).emit("video-answer", {
      sdp: data.sdp,
      sender: socket.id,
    });
    console.log(`Video answer from ${socket.id} forwarded in room ${data.room}`);
  });

  socket.on("new-ice-candidate", (data) => {
    // Forward new ICE candidates to the other peer in the room
    socket.to(data.room).emit("new-ice-candidate", {
      candidate: data.candidate,
      sender: socket.id,
    });
    console.log(`New ICE candidate from ${socket.id} forwarded in room ${data.room}`);
  });

  // Handle leaving a room
  socket.on("leave-room", (roomName) => {
    socket.leave(roomName, () => {
      console.log(`Socket ${socket.id} left room ${roomName}`);
      socket.to(roomName).emit("partner-disconnected", {
        message: "Your partner has left the chat.",
      });
    });
  });

  // When a socket disconnects (or is disconnecting), notify its partner and move partner to waiting
  socket.on("disconnecting", () => {
    console.log(`Client disconnecting: ${socket.id}`);
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        const clients = io.sockets.adapter.rooms.get(room);
        if (clients && clients.size > 1) {
          const partnerId = Array.from(clients).find((id) => id !== socket.id);
          console.log("The other user's id is:", partnerId);
          io.to(partnerId).emit("partner-disconnected", {
            message: "Your partner has disconnected. Waiting for a new partner...",
          });
          const partnerSocket = io.sockets.sockets.get(partnerId);
          waitingSocket = partnerSocket; // Place the remaining partner into waiting state
          partnerSocket.emit("waiting", { message: "Waiting for a partner..." });
        }
      }
    });
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    if (waitingSocket && waitingSocket.id === socket.id) {
      waitingSocket = null;
    }
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
