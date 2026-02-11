const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {}; // { roomName: [{username, profilePic}] }
const voiceChannels = {}; // { channelName: [{id, username, profilePic}] }

io.on('connection', socket => {
  console.log('a user connected', socket.id);

  // --- TEXT CHAT ---
  socket.on('join-room', ({room, username, profilePic}) => {
    socket.join(room);
    if (!rooms[room]) rooms[room] = [];
    rooms[room].push({ id: socket.id, username, profilePic });
    // Load previous messages if needed
    // For now we won't persist text messages
    socket.emit('load-messages', []); 
  });

  socket.on('message', ({room, text, username, profilePic}) => {
    io.to(room).emit('message', { text, username, profilePic });
  });

  // --- VOICE CHAT ---
  socket.on('voice-join', ({channel, username, profilePic}) => {
    socket.join(channel);
    if (!voiceChannels[channel]) voiceChannels[channel] = [];
    voiceChannels[channel].push({ id: socket.id, username, profilePic });
    // Send new peer list to everyone in channel
    const others = voiceChannels[channel].filter(u => u.id !== socket.id);
    socket.emit('voice-users', { channel, users: voiceChannels[channel] });
    others.forEach(u => io.to(u.id).emit('new-peer', socket.id));
    io.to(channel).emit('voice-users', { channel, users: voiceChannels[channel] });
  });

  socket.on('update-profile', ({username, profilePic, channel}) => {
    if (!voiceChannels[channel]) return;
    const user = voiceChannels[channel].find(u => u.id === socket.id);
    if (user) { user.username = username; user.profilePic = profilePic; }
    io.to(channel).emit('voice-users', { channel, users: voiceChannels[channel] });
  });

  socket.on('signal', ({to, signal}) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('voice-leave', ({channel, username}) => {
    if (!voiceChannels[channel]) return;
    voiceChannels[channel] = voiceChannels[channel].filter(u => u.id !== socket.id);
    io.to(channel).emit('peer-left', socket.id);
    io.to(channel).emit('voice-users', { channel, users: voiceChannels[channel] });
  });

  socket.on('disconnect', () => {
    // Remove from all voice channels
    for (const channel in voiceChannels) {
      voiceChannels[channel] = voiceChannels[channel].filter(u => u.id !== socket.id);
      io.to(channel).emit('peer-left', socket.id);
      io.to(channel).emit('voice-users', { channel, users: voiceChannels[channel] });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
