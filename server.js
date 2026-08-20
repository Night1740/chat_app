const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join room', ({ code, name }) => {
    if (!rooms[code]) {
      rooms[code] = { messages: [], users: new Set() };
    }

    socket.join(code);
    rooms[code].users.add(name);

    // Send existing messages to the new user
    const room = rooms[code];
    socket.emit('load messages', room.messages);

    // Notify others
    socket.to(code).emit('user joined', { name, code });

    socket.on('disconnect', () => {
      rooms[code].users.delete(name);
      socket.leave(code);
      io.to(code).emit('user left', { name, code });
    });
  });

  socket.on('chat message', ({ code, name, text }) => {
    const room = rooms[code];
    if (room && room.messages.length < 100) {
      room.messages.push({ name, text });
      io.to(code).emit('chat message', { name, text });
    }
  });

  socket.on('leave room', ({ code, name }) => {
    rooms[code].users.delete(name);
    socket.leave(code);
    io.to(code).emit('user left', { name, code });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});