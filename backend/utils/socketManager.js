let io;

function init(server, isAllowedOriginFn) {
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOriginFn(origin)) return callback(null, true);
        return callback(new Error('Socket CORS origin not allowed'));
      },
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Socket connected:', socket.id); // temporary — remove later

    // Client joins the room for whatever pincode it's currently viewing.
    socket.on('join', (pincode) => {
      console.log('📍 Joined room:', pincode); // temporary — remove later
      if (pincode) socket.join(String(pincode));
    });
    socket.on('leave', (pincode) => {
      if (pincode) socket.leave(String(pincode));
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io accessed before init()');
  return io;
}

module.exports = { init, getIO };