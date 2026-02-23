const Chat = require('../models/Chat');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { createNotification } = require('../utils/notify');

const MAX_CHAT_MESSAGES = 1500;

const normalizeId = (value) => {
  if (!value) return '';
  if (typeof value === 'object') {
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
  }
  return String(value);
};

const isFarmerBuyerPair = (roleA, roleB) =>
  (roleA === 'buyer' && roleB === 'farmer') || (roleA === 'farmer' && roleB === 'buyer');

const computeUnreadCount = (messages = [], currentUserId) =>
  messages.reduce((count, message) => {
    const senderId = normalizeId(message.sender);
    const isMine = senderId === normalizeId(currentUserId);
    const isRead = (message.readBy || []).some((readerId) => normalizeId(readerId) === normalizeId(currentUserId));
    return !isMine && !isRead ? count + 1 : count;
  }, 0);

const formatChatSummary = (chat, currentUserId) => {
  const messages = chat.messages || [];
  const lastMessage = messages[messages.length - 1];

  return {
    _id: chat._id,
    participants: chat.participants,
    context: chat.context,
    lastMessagePreview: chat.lastMessagePreview || lastMessage?.text || '',
    lastMessageSender: chat.lastMessageSender || lastMessage?.sender || null,
    lastMessageAt: chat.lastMessageAt || lastMessage?.createdAt || chat.updatedAt,
    unreadCount: computeUnreadCount(messages, currentUserId),
    messageCount: messages.length,
    updatedAt: chat.updatedAt,
  };
};

const assertParticipantInChat = (chat, userId, next) => {
  const isParticipant = (chat.participants || []).some(
    (participant) => normalizeId(participant) === normalizeId(userId),
  );

  if (!isParticipant) {
    return next(new AppError('Not authorized for this chat', 403));
  }

  return null;
};

const getOrCreateChat = catchAsync(async (req, res, next) => {
  const { participantId, productId, initialMessage } = req.body;

  if (!participantId) {
    return next(new AppError('participantId is required', 400));
  }

  if (normalizeId(participantId) === normalizeId(req.user._id)) {
    return next(new AppError('You cannot create a chat with yourself', 400));
  }

  const participant = await User.findById(participantId).select(
    '_id name role isFarmerVerified blocked isActive',
  );

  if (!participant) {
    return next(new AppError('Participant not found', 404));
  }

  if (!participant.isActive || participant.blocked) {
    return next(new AppError('Participant account is unavailable', 403));
  }

  if (!isFarmerBuyerPair(req.user.role, participant.role)) {
    return next(new AppError('Chats are only allowed between a buyer and a farmer', 400));
  }

  let context = undefined;

  if (productId) {
    const product = await Product.findById(productId).select('_id name farmer status');
    if (!product) {
      return next(new AppError('Context product not found', 404));
    }

    const productFarmerId = normalizeId(product.farmer);
    const currentUserId = normalizeId(req.user._id);
    const targetUserId = normalizeId(participant._id);

    if (productFarmerId !== currentUserId && productFarmerId !== targetUserId) {
      return next(new AppError('Selected product is not owned by this farmer', 400));
    }

    context = {
      product: product._id,
      subject: `Regarding ${product.name}`,
    };
  }

  let chat = await Chat.findOne({
    participants: { $all: [req.user._id, participant._id], $size: 2 },
  });

  if (!chat) {
    chat = await Chat.create({
      participants: [req.user._id, participant._id],
      ...(context ? { context } : {}),
      messages: [],
    });
  } else if (!chat.context?.product && context?.product) {
    chat.context = context;
  }

  if (typeof initialMessage === 'string' && initialMessage.trim()) {
    const now = new Date();
    const message = {
      sender: req.user._id,
      text: initialMessage.trim().slice(0, 1000),
      readBy: [req.user._id],
      createdAt: now,
    };

    chat.messages.push(message);
    chat.lastMessagePreview = message.text.slice(0, 240);
    chat.lastMessageSender = req.user._id;
    chat.lastMessageAt = now;
  }

  await chat.save();

  chat = await Chat.findById(chat._id)
    .populate('participants', 'name role avatar isFarmerVerified location')
    .populate('context.product', 'name images pricePerUnit farmer');

  res.status(200).json({
    status: 'success',
    chat: formatChatSummary(chat, req.user._id),
  });
});

const listMyChats = catchAsync(async (req, res) => {
  const chats = await Chat.find({ participants: req.user._id })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate('participants', 'name role avatar isFarmerVerified location')
    .populate('context.product', 'name images pricePerUnit farmer')
    .limit(120);

  const summaries = chats.map((chat) => formatChatSummary(chat, req.user._id));

  res.status(200).json({
    status: 'success',
    count: summaries.length,
    chats: summaries,
  });
});

const listChatContacts = catchAsync(async (req, res) => {
  let contactIds = [];

  if (req.user.role === 'buyer') {
    const [userWithSubs, orderFarmerIds] = await Promise.all([
      User.findById(req.user._id).select('subscribedFarmers'),
      Order.distinct('items.farmer', { buyer: req.user._id }),
    ]);

    const subscribedIds = userWithSubs?.subscribedFarmers || [];
    contactIds = [...new Set([...subscribedIds, ...orderFarmerIds].map((id) => normalizeId(id)))];
  } else {
    const buyerIds = await Order.distinct('buyer', { 'items.farmer': req.user._id });
    contactIds = [...new Set(buyerIds.map((id) => normalizeId(id)))];
  }

  if (!contactIds.length) {
    return res.status(200).json({
      status: 'success',
      contacts: [],
    });
  }

  const [contacts, chats] = await Promise.all([
    User.find({
      _id: { $in: contactIds },
      role: req.user.role === 'buyer' ? 'farmer' : 'buyer',
      isActive: true,
      blocked: false,
    }).select('name role avatar isFarmerVerified location farmerProfile'),
    Chat.find({ participants: req.user._id }).select(
      'participants messages lastMessagePreview lastMessageAt lastMessageSender updatedAt',
    ),
  ]);

  const chatByContactId = new Map();

  chats.forEach((chat) => {
    const otherId = chat.participants.find((id) => normalizeId(id) !== normalizeId(req.user._id));
    if (!otherId) return;

    chatByContactId.set(normalizeId(otherId), {
      chatId: chat._id,
      lastMessagePreview: chat.lastMessagePreview || chat.messages[chat.messages.length - 1]?.text || '',
      lastMessageAt:
        chat.lastMessageAt || chat.messages[chat.messages.length - 1]?.createdAt || chat.updatedAt,
      unreadCount: computeUnreadCount(chat.messages, req.user._id),
    });
  });

  const contactPayload = contacts
    .map((contact) => {
      const mapped = chatByContactId.get(normalizeId(contact._id));
      return {
        ...contact.toObject(),
        hasChat: Boolean(mapped?.chatId),
        chatId: mapped?.chatId || null,
        lastMessagePreview: mapped?.lastMessagePreview || '',
        lastMessageAt: mapped?.lastMessageAt || null,
        unreadCount: mapped?.unreadCount || 0,
      };
    })
    .sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.name.localeCompare(b.name);
    });

  res.status(200).json({
    status: 'success',
    contacts: contactPayload,
  });
});

const getChatMessages = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 40, 1), 100);

  const chat = await Chat.findById(chatId)
    .populate('participants', 'name role avatar isFarmerVerified location')
    .populate('context.product', 'name images pricePerUnit farmer');

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  const unauthorized = assertParticipantInChat(chat, req.user._id, next);
  if (unauthorized) return unauthorized;

  const totalMessages = chat.messages.length;
  const end = totalMessages - (page - 1) * limit;
  const start = Math.max(end - limit, 0);
  const boundedEnd = Math.max(end, 0);
  const pageMessages = chat.messages.slice(start, boundedEnd);

  const senderIds = [
    ...new Set(pageMessages.map((message) => normalizeId(message.sender)).filter(Boolean)),
  ];

  const senders = await User.find({ _id: { $in: senderIds } }).select(
    '_id name role avatar isFarmerVerified',
  );
  const senderMap = new Map(senders.map((sender) => [normalizeId(sender._id), sender]));

  const serializedMessages = pageMessages.map((message) => ({
    _id: message._id,
    sender: senderMap.get(normalizeId(message.sender)) || { _id: message.sender },
    text: message.text,
    readBy: message.readBy,
    createdAt: message.createdAt,
  }));

  res.status(200).json({
    status: 'success',
    chat: formatChatSummary(chat, req.user._id),
    page,
    limit,
    totalMessages,
    hasMore: start > 0,
    messages: serializedMessages,
  });
});

const markChatRead = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  const unauthorized = assertParticipantInChat(chat, req.user._id, next);
  if (unauthorized) return unauthorized;

  let changed = false;
  chat.messages.forEach((message) => {
    const isMine = normalizeId(message.sender) === normalizeId(req.user._id);
    const isRead = message.readBy.some((readerId) => normalizeId(readerId) === normalizeId(req.user._id));

    if (!isMine && !isRead) {
      message.readBy.push(req.user._id);
      changed = true;
    }
  });

  if (changed) {
    await chat.save();
  }

  const unreadCount = computeUnreadCount(chat.messages, req.user._id);

  if (req.io) {
    req.io.to(`chat:${chat._id}`).emit('chat:read', {
      chatId: chat._id,
      userId: req.user._id,
      unreadCount,
      readAt: new Date(),
    });

    req.io.to(`user:${req.user._id}`).emit('chat:thread-updated', {
      chatId: chat._id,
      unreadCount,
    });
  }

  res.status(200).json({
    status: 'success',
    unreadCount,
  });
});

const sendMessage = catchAsync(async (req, res, next) => {
  const { chatId } = req.params;
  const { text } = req.body;

  if (!text || !text.trim()) {
    return next(new AppError('Message text is required', 400));
  }

  const safeText = text.trim().slice(0, 1000);
  const chat = await Chat.findById(chatId).populate('participants', '_id name preferences isActive blocked');

  if (!chat) {
    return next(new AppError('Chat not found', 404));
  }

  const unauthorized = assertParticipantInChat(chat, req.user._id, next);
  if (unauthorized) return unauthorized;

  const timestamp = new Date();
  const newMessage = {
    sender: req.user._id,
    text: safeText,
    readBy: [req.user._id],
    createdAt: timestamp,
  };

  chat.messages.push(newMessage);

  if (chat.messages.length > MAX_CHAT_MESSAGES) {
    chat.messages = chat.messages.slice(-MAX_CHAT_MESSAGES);
  }

  chat.lastMessagePreview = safeText.slice(0, 240);
  chat.lastMessageSender = req.user._id;
  chat.lastMessageAt = timestamp;
  await chat.save();

  const persistedMessage = chat.messages[chat.messages.length - 1].toObject();
  const serializedMessage = {
    ...persistedMessage,
    sender: {
      _id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      avatar: req.user.avatar || '',
      isFarmerVerified: Boolean(req.user.isFarmerVerified),
    },
  };

  const recipientParticipants = (chat.participants || []).filter(
    (participant) => normalizeId(participant._id) !== normalizeId(req.user._id),
  );

  const recipients = recipientParticipants.filter((participant) => {
    if (!participant.isActive || participant.blocked) return false;
    const wantsChat = participant.preferences?.notifications?.chatMessages !== false;
    const wantsInApp = participant.preferences?.notifications?.inApp !== false;
    return wantsChat && wantsInApp;
  });

  await Promise.all(
    recipients.map((recipient) =>
      createNotification({
        user: recipient._id,
        type: 'chat',
        title: 'New chat message',
        message: `${req.user.name} sent you a message`,
        metadata: { chatId: chat._id },
        io: req.io,
      }),
    ),
  );

  if (req.io) {
    const realtimePayload = {
      chatId: chat._id,
      message: serializedMessage,
      thread: {
        chatId: chat._id,
        lastMessagePreview: chat.lastMessagePreview,
        lastMessageSender: chat.lastMessageSender,
        lastMessageAt: chat.lastMessageAt,
      },
    };

    req.io.to(`chat:${chat._id}`).emit('chat:message', realtimePayload);

    chat.participants.forEach((participant) => {
      const participantId = normalizeId(participant._id || participant);
      const unreadCount = computeUnreadCount(chat.messages, participantId);
      req.io.to(`user:${participantId}`).emit('chat:thread-updated', {
        chatId: chat._id,
        lastMessagePreview: chat.lastMessagePreview,
        lastMessageSender: chat.lastMessageSender,
        lastMessageAt: chat.lastMessageAt,
        unreadCount,
      });
    });
  }

  res.status(201).json({
    status: 'success',
    message: serializedMessage,
    thread: {
      chatId: chat._id,
      lastMessagePreview: chat.lastMessagePreview,
      lastMessageSender: chat.lastMessageSender,
      lastMessageAt: chat.lastMessageAt,
    },
  });
});

module.exports = {
  getOrCreateChat,
  listMyChats,
  listChatContacts,
  getChatMessages,
  markChatRead,
  sendMessage,
};
