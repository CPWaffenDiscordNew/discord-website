const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// In-memory storage for messages per room
const messages = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ room, username }) => {
    socket.join(room);

    // Send existing messages to the new user
    if (messages[room]) {
      socket.emit("load-messages", messages[room]);
    } else {
      messages[room] = [];
    }

    // Broadcast a join notification
    socket.to(room).emit("message", { username: "System", text: `${username} joined the room.` });
  });

  socket.on("message", (data) => {
    // Save message to memory
    if (!messages[data.room]) messages[data.room] = [];
    messages[data.room].push({ username: data.username, text: data.text });

    io.to(data.room).emit("message", { username: data.username, text: data.text });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
