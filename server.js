const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const messages = {};
const voiceRooms = {}; // track users in voice rooms

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ room, username }) => {
    socket.join(room);
    if (messages[room]) socket.emit("load-messages", messages[room]);
    else messages[room] = [];
    socket.to(room).emit("message", { username: "System", text: `${username} joined the room.` });
  });

  socket.on("message", (data) => {
    if (!messages[data.room]) messages[data.room] = [];
    messages[data.room].push({ username: data.username, text: data.text });
    io.to(data.room).emit("message", { username: data.username, text: data.text });
  });

  // Voice chat signaling
  socket.on("voice-join", ({ room, username }) => {
    if (!voiceRooms[room]) voiceRooms[room] = [];
    voiceRooms[room].push(socket.id);
    socket.to(room).emit("voice-user-joined", { id: socket.id, username });
  });

  socket.on("disconnect", () => {
    for (const room in voiceRooms) {
      voiceRooms[room] = voiceRooms[room].filter(id => id !== socket.id);
      socket.to(room).emit("voice-user-left", { id: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
