const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
app.use(express.static(__dirname));

let messages = {}; // room: [{username, text, profilePic}]
let voiceUsers = {}; // channel: [{id, username, profilePic}]

io.on('connection', socket=>{
  console.log('User connected', socket.id);

  // Text chat
  socket.on('join-room', ({room, username, profilePic})=>{
    socket.join(room);
    if(!messages[room]) messages[room]=[];
    socket.emit('load-messages', messages[room]);
    messages[room].push({username, text:`joined the room`, profilePic});
    io.to(room).emit('message',{username, text:'joined the room', profilePic});
  });

  socket.on('message', ({room, username, text, profilePic})=>{
    const msg={username, text, profilePic};
    messages[room].push(msg);
    io.to(room).emit('message', msg);
  });

  // Voice chat
  socket.on('voice-join', ({channel, username, profilePic})=>{
    socket.join(channel);
    if(!voiceUsers[channel]) voiceUsers[channel]=[];
    const existing = voiceUsers[channel].find(u=>u.id===socket.id);
    if(existing){ existing.username=username; existing.profilePic=profilePic; }
    else voiceUsers[channel].push({id:socket.id, username, profilePic});
    io.to(channel).emit('voice-users',{channel, users:voiceUsers[channel]});
    socket.to(channel).emit('new-peer', socket.id);
  });

  socket.on('voice-leave', ({channel})=>{
    if(voiceUsers[channel]){
      voiceUsers[channel]=voiceUsers[channel].filter(u=>u.id!==socket.id);
      io.to(channel).emit('voice-users',{channel, users:voiceUsers[channel]});
    }
  });

  socket.on('update-profile', ({username, profilePic, channel})=>{
    if(!voiceUsers[channel]) return;
    const u = voiceUsers[channel].find(u=>u.id===socket.id);
    if(u){ u.username=username; u.profilePic=profilePic; }
    io.to(channel).emit('voice-users',{channel, users:voiceUsers[channel]});
  });

  socket.on('signal', ({to, signal})=>{
    io.to(to).emit('signal',{from:socket.id, signal});
  });

  socket.on('disconnect', ()=>{
    for(let channel in voiceUsers){
      voiceUsers[channel]=voiceUsers[channel].filter(u=>u.id!==socket.id);
      io.to(channel).emit('voice-users',{channel, users:voiceUsers[channel]});
    }
    console.log('User disconnected', socket.id);
  });
});

http.listen(3000, ()=>console.log('Server running on port 3000'));
