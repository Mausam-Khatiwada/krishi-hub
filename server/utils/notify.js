const Notification = require('../models/Notification');

const createNotification = async ({ user, type = 'system', title, message, metadata = {}, io }) => {
  const notification = await Notification.create({
    user,
    type,
    title,
    message,
    metadata,
  });

  if (io) {
    io.to(`user:${user}`).emit('notification:new', notification);
  }

  return notification;
};

module.exports = {
  createNotification,
};
