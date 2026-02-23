const http = require('http');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = require('./app');
const connectDB = require('./config/db');
const setupCloudinary = require('./config/cloudinary');
const User = require('./models/User');
const Chat = require('./models/Chat');

setupCloudinary();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL?.split(',') || ['http://localhost:5173'],
    credentials: true,
  },
});

app.set('io', io);

const resolveSocketUserId = (socket) => {
  const auth = socket.handshake.auth || {};
  const token = typeof auth.token === 'string' ? auth.token.trim() : '';
  const fallbackUserId = typeof auth.userId === 'string' ? auth.userId.trim() : '';

  if (!token) {
    return fallbackUserId;
  }

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return decoded?.id || decoded?._id || decoded?.userId || fallbackUserId;
};

const canJoinChat = async (chatId, userId) => {
  if (!chatId || !userId) return false;

  try {
    const chat = await Chat.findOne({ _id: chatId, participants: userId }).select('_id');
    return Boolean(chat);
  } catch (_error) {
    return false;
  }
};

io.use(async (socket, next) => {
  try {
    const resolvedUserId = resolveSocketUserId(socket);

    if (!resolvedUserId) {
      return next(new Error('Unauthorized socket connection'));
    }

    const user = await User.findById(resolvedUserId).select('_id isActive blocked');

    if (!user || !user.isActive || user.blocked) {
      return next(new Error('Unauthorized socket connection'));
    }

    socket.data.userId = String(user._id);
    socket.data.joinedChats = new Set();
    return next();
  } catch (_error) {
    return next(new Error('Unauthorized socket connection'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;

  if (userId) {
    socket.join(`user:${userId}`);
  }

  socket.on('join:chat', async (chatId) => {
    const chatKey = String(chatId || '').trim();
    if (!chatKey || !userId) return;

    const allowed = await canJoinChat(chatKey, userId);
    if (!allowed) return;

    socket.data.joinedChats.add(chatKey);
    socket.join(`chat:${chatKey}`);
  });

  socket.on('leave:chat', (chatId) => {
    const chatKey = String(chatId || '').trim();
    if (!chatKey) return;

    socket.data.joinedChats.delete(chatKey);
    socket.leave(`chat:${chatKey}`);
  });

  socket.on('typing:start', ({ chatId } = {}) => {
    const chatKey = String(chatId || '').trim();
    if (!chatKey || !socket.data.joinedChats.has(chatKey)) return;

    socket.to(`chat:${chatKey}`).emit('typing:start', {
      chatId: chatKey,
      userId,
      typingAt: new Date().toISOString(),
    });
  });

  socket.on('typing:stop', ({ chatId } = {}) => {
    const chatKey = String(chatId || '').trim();
    if (!chatKey || !socket.data.joinedChats.has(chatKey)) return;

    socket.to(`chat:${chatKey}`).emit('typing:stop', {
      chatId: chatKey,
      userId,
      typingAt: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    socket.data.joinedChats.clear();
  });
});

const PORT = Number(process.env.PORT || 5000);

const bootstrap = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Krishihub API server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server startup failed', error);
    process.exit(1);
  }
};

bootstrap();
