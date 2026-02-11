const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

const voicePeers = {}; // { channelName: { socketId: peerInfo } }

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ room, username }) => {
    socket.join(room);
    socket.room = room;
    socket.username = username;
    socket.emit('load-messages', []); // empty or implement persistent storage
  });

  socket.on('message', data => {
    io.to(data.room).emit('message', data);
  });

  // ---------------- Voice chat signaling ----------------
  socket.on('voice-join', ({ channel, username }) => {
    socket.channel = channel;
    socket.username = username;
    socket.join(channel);

    if (!voicePeers[channel]) voicePeers[channel] = {};
    voicePeers[channel][socket.id] = socket;

    // Notify existing peers
    for (let peerId in voicePeers[channel]) {
      if (peerId !== socket.id) {
        socket.emit('new-peer', peerId);
        voicePeers[channel][peerId].emit('new-peer', socket.id);
      }
    }
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { from: socket.id, signal });
  });

  socket.on('voice-leave', ({ channel }) => {
    if (voicePeers[channel]) {
      delete voicePeers[channel][socket.id];
      socket.leave(channel);
      io.to(channel).emit('peer-left', socket.id);
    }
  });

  socket.on('disconnect', () => {
    const channel = socket.channel;
    if (channel && voicePeers[channel]) {
      delete voicePeers[channel][socket.id];
      io.to(channel).emit('peer-left', socket.id);
    }
  });
});

http.listen(3000, () => console.log('Server running on port 3000'));
