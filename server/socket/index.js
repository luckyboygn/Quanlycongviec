const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

let ioInstance = null;
const onlineUsers = new Map(); // userId (number) -> Set of socketId (string)

function initSocket(server) {
  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingInterval: 25000,
    pingTimeout: 20000
  });

  // JWT Authentication Middleware for Socket.IO
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('AUTHENTICATION_ERROR: Token không được cung cấp'));
      }

      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          return next(new Error('AUTHENTICATION_ERROR: Token không hợp lệ hoặc đã hết hạn'));
        }
        socket.user = decoded;
        next();
      });
    } catch (err) {
      next(new Error('AUTHENTICATION_ERROR: ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    if (!user || !user.id) {
      socket.disconnect(true);
      return;
    }

    const userId = parseInt(user.id);

    // Track online user sockets
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    const isFirstConnection = onlineUsers.get(userId).size === 0;
    onlineUsers.get(userId).add(socket.id);

    // Auto join personal, general and department rooms
    socket.join(`user_${userId}`);
    socket.join('general');
    if (user.department_id) {
      socket.join(`dept_${user.department_id}`);
    }

    // Broadcast online status if this is the user's first active tab/device
    if (isFirstConnection) {
      io.emit('user:online_change', {
        userId,
        isOnline: true,
        onlineCount: onlineUsers.size
      });
    }

    // Send current online user list to newly connected socket
    socket.emit('system:online_list', {
      onlineUserIds: Array.from(onlineUsers.keys())
    });

    // Handle manual disconnect / connection drop
    socket.on('disconnect', () => {
      if (onlineUsers.has(userId)) {
        const userSockets = onlineUsers.get(userId);
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Broadcast offline status
          io.emit('user:online_change', {
            userId,
            isOnline: false,
            onlineCount: onlineUsers.size
          });
        }
      }
    });
  });

  ioInstance = io;
  return io;
}

function getIO() {
  return ioInstance;
}

function isUserOnline(userId) {
  const uId = parseInt(userId);
  return onlineUsers.has(uId) && onlineUsers.get(uId).size > 0;
}

function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

/**
 * Broadcast newly created chat message to appropriate recipients
 */
function broadcastChatMessage(messageData) {
  if (!ioInstance) return;

  const { channel, receiver_id, sender_id } = messageData;

  if (channel === 'general') {
    // School-wide channel
    ioInstance.to('general').emit('chat:message', messageData);
  } else if (channel && channel.startsWith('dept_')) {
    // Department channel
    ioInstance.to(channel).emit('chat:message', messageData);
  } else if (receiver_id) {
    // Direct Message: emit to receiver's personal room & sender's room
    ioInstance.to(`user_${receiver_id}`).emit('chat:message', messageData);
    ioInstance.to(`user_${sender_id}`).emit('chat:message', messageData);
    // Send unread sync signal to receiver
    ioInstance.to(`user_${receiver_id}`).emit('chat:unread_update', {
      sender_id,
      increment: 1
    });
  }
}

/**
 * Broadcast message deletion
 */
function broadcastMessageDeleted(messageId, channel, receiverId, senderId) {
  if (!ioInstance) return;
  const payload = { messageId, channel, receiverId, senderId };
  if (channel === 'general') {
    ioInstance.to('general').emit('chat:deleted', payload);
  } else if (channel && channel.startsWith('dept_')) {
    ioInstance.to(channel).emit('chat:deleted', payload);
  } else if (receiverId) {
    ioInstance.to(`user_${receiverId}`).emit('chat:deleted', payload);
    ioInstance.to(`user_${senderId}`).emit('chat:deleted', payload);
  }
}

/**
 * Broadcast message recall
 */
function broadcastMessageRecalled(messageId, channel, receiverId, senderId) {
  if (!ioInstance) return;
  const payload = { messageId, channel, receiverId, senderId };
  if (channel === 'general') {
    ioInstance.to('general').emit('chat:recalled', payload);
  } else if (channel && channel.startsWith('dept_')) {
    ioInstance.to(channel).emit('chat:recalled', payload);
  } else if (receiverId) {
    ioInstance.to(`user_${receiverId}`).emit('chat:recalled', payload);
    ioInstance.to(`user_${senderId}`).emit('chat:recalled', payload);
  }
}

/**
 * Real-time kick out old session if user logs in on another device
 */
function terminateUserSessions(userId, reason = 'session_terminated') {
  if (!ioInstance) return;
  const uId = parseInt(userId);
  ioInstance.to(`user_${uId}`).emit('auth:session_terminated', { reason });
}

module.exports = {
  initSocket,
  getIO,
  isUserOnline,
  getOnlineUserIds,
  broadcastChatMessage,
  broadcastMessageDeleted,
  broadcastMessageRecalled,
  terminateUserSessions
};
