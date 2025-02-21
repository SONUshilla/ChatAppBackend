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

  // Auto pairing logic
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
      message: "You've been paired! Start chatting now.",
    });

    console.log(
      `Paired ${waitingSocket.id} and ${socket.id} in room ${roomName}`
    );

    // Clear the waiting socket variable
    waitingSocket = null;
  } else {
    // No one is waiting: mark this socket as waiting
    waitingSocket = socket;
    socket.emit("waiting", { message: "Waiting for a partner..." });
    console.log(`Socket ${socket.id} is waiting for a partner`);
  }

  // Handle chat messages within a room
  socket.on("message", ({ room, message }) => {
    // Broadcast the message to the other user in the room
    socket.to(room).emit("message", message);
  });
  socket.on("leave-room", (roomName) => {
    // Remove the socket from the specified room
    socket.leave(roomName, () => {
      console.log(`Socket ${socket.id} left room ${roomName}`);

      // Notify the remaining socket(s) in the room that their partner has left
      socket.to(roomName).emit("partner-disconnected", {
        message: "Your partner has left the chat.",
      });

      // Optional: you can perform additional cleanup here if needed.
    });
  });

  // On disconnect, clear the waitingSocket if necessary
  // In your server code's disconnect handler
  socket.on("disconnecting", () => {
    console.log(`Client disconnecting: ${socket.id}`);
    // Iterate over rooms before they are cleared
    socket.rooms.forEach((room) => {
      if (room !== socket.id) {
        // 'room' is the room name and 'socket' is the current socket
        const clients = io.sockets.adapter.rooms.get(room);
        if (clients && clients.size > 1) {
          // Convert the set to an array and filter out the current socket's id
          const partnerId = Array.from(clients).find((id) => id !== socket.id);
          console.log("The other user's id is:", partnerId);

          // Now emit an event specifically to the partner
          io.to(partnerId).emit("partner-disconnected", {
            message: "Your partner has disconnected.",
          });
          const partnerSocket = io.sockets.sockets.get(partnerId);
          waitingSocket = partnerSocket; // Store the socket object
          
        }
      }
    });
  });

  // Optionally keep your disconnect event for cleanup
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    if (waitingSocket && waitingSocket.id === socket.id) {
      waitingSocket = null;
    }
  });
});

server.listen(5000, () => console.log("Server running on port 5000"));
