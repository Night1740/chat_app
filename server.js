const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Admin credentials (change as needed)
const ADMIN_CREDENTIALS = {
  username: 'DarkTiger',
  password: 'night_1117'
};

// Room storage (in-memory)
const rooms = {};
const admins = new Set(); // Track authenticated admin sockets

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Phase 1: Admin Login
  socket.on('admin login', ({ username, password }) => {
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      admins.add(socket);
      socket.admin = true;
      socket.adminName = username;
      socket.emit('admin login success', { success: true });
    } else {
      socket.emit('admin login success', { success: false, error: 'Invalid credentials' });
    }
  });

  // Phase 2: Join room
  socket.on('join room', ({ code, name }) => {
    const isAdmin = socket.admin;

    // If not admin, require room to already exist
    if (!isAdmin && !rooms[code]) {
      socket.emit('join denied', { error: 'Channel does not exist. Admin must create it first.' });
      return;
    }

    if (!rooms[code]) {
      rooms[code] = { messages: [], users: new Set(), createdBy: null };
    }

    socket.join(code);
    rooms[code].users.add(name);

    // Send existing messages to the new user
    const room = rooms[code];
    socket.emit('load messages', room.messages);

    // Notify others in the room
    socket.to(code).emit('user joined', { name, code, isAdmin });

    socket.on('disconnect', () => {
      rooms[code].users.delete(name);
      socket.leave(code);
      io.to(code).emit('user left', { name, code });
    });
  });

  // Phase 3: Create channel (admin only)
  socket.on('create channel', ({ code }) => {
    if (!socket.admin) {
      socket.emit('error', { message: 'Only admin can create channels' });
      return;
    }

    if (!rooms[code]) {
      rooms[code] = { messages: [], users: new Set(), createdBy: socket.adminName };
    }

    socket.join(code);
    socket.to('global').emit('channel created', { code, admin: socket.adminName });
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