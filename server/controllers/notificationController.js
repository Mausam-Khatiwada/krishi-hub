const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');

const listNotifications = catchAsync(async (req, res) => {
  const notifications = await Notification.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    status: 'success',
    count: notifications.length,
    notifications,
  });
});

const markAsRead = catchAsync(async (req, res) => {
  await Notification.findOneAndUpdate(
    {
      _id: req.params.id,
      user: req.user._id,
    },
    { isRead: true },
    { new: true },
  );

  res.status(200).json({
    status: 'success',
  });
});

const markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });

  res.status(200).json({
    status: 'success',
  });
});

module.exports = {
  listNotifications,
  markAsRead,
  markAllAsRead,
};
