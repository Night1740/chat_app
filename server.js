const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};
const ADMIN_NAME = 'Admin'; // Change this to your desired admin name

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join room', ({ code, name }) => {
    const isAdmin = name === ADMIN_NAME;

    if (!rooms[code]) {
      rooms[code] = { messages: [], users: new Set(), createdBy: null };
      if (isAdmin) {
        rooms[code].createdBy = name;
      }
    }

    socket.join(code);
    rooms[code].users.add(name);

    // Send existing messages to the new user
    const room = rooms[code];
    socket.emit('load messages', room.messages);

    // Notify others
    socket.to(code).emit('user joined', { name, code, isAdmin });

    // Handle create channel (admin only)
    if (isAdmin) {
      socket.on('create channel', ({ code: newCode }) => {
        if (!rooms[newCode]) {
          rooms[newCode] = { messages: [], users: new Set(), createdBy: name };
          socket.join(newCode);
          socket.to(code).emit('channel created', { code: newCode, admin: name });
        }
      });
    }

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