const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const messages = {}; // { roomName: [ {username,text,profilePic} ] }
const voiceChannels = {}; // { channelName: [{username, profilePic}] }

// --- Socket.IO events ---
io.on('connection', socket => {
  console.log('User connected:', socket.id);

  // TEXT CHAT
  socket.on('join-room', ({ room, username, profilePic }) => {
    socket.join(room);
    if (!messages[room]) messages[room] = [];
    socket.emit('load-messages', messages[room]);
    console.log(`${username} joined room: ${room}`);
  });

  socket.on('message', ({ room, text, username, profilePic }) => {
    const msg = { username, text, profilePic };
    if (!messages[room]) messages[room] = [];
    messages[room].push(msg);
    io.to(room).emit('message', msg);
  });

  // VOICE CHAT
  socket.on('voice-join', ({ channel, username, profilePic }) => {
    socket.join(channel);
    if (!voiceChannels[channel]) voiceChannels[channel] = [];
    voiceChannels[channel].push({ username, profilePic, id: socket.id });
    io.emit('voice-users', { channel, users: voiceChannels[channel] });
    socket.broadcast.emit('new-peer', socket.id);
  });

  socket.on('voice-leave', ({ channel, username }) => {
    if (voiceChannels[channel]) {
      voiceChannels[channel] = voiceChannels[channel].filter(u => u.id !== socket.id);
      io.emit('voice-users', { channel, users: voiceChannels[channel] });
    }
    socket.broadcast.emit('peer-left', socket.id);
  });

  // WebRTC signals
  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Remove user from all voice channels
    Object.keys(voiceChannels).forEach(channel => {
      voiceChannels[channel] = voiceChannels[channel].filter(u => u.id !== socket.id);
      io.emit('voice-users', { channel, users: voiceChannels[channel] });
      socket.broadcast.emit('peer-left', socket.id);
    });
  });
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
