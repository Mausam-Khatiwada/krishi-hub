const ForumPost = require('../models/ForumPost');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

const createPost = catchAsync(async (req, res) => {
  const post = await ForumPost.create({
    user: req.user._id,
    title: req.body.title,
    content: req.body.content,
    tags: req.body.tags || [],
  });

  res.status(201).json({
    status: 'success',
    post,
  });
});

const listPosts = catchAsync(async (req, res) => {
  const { search } = req.query;
  const filter = {};

  if (search) {
    filter.$text = { $search: search };
  }

  const posts = await ForumPost.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name role')
    .populate('comments.user', 'name')
    .limit(100);

  res.status(200).json({
    status: 'success',
    count: posts.length,
    posts,
  });
});

const addComment = catchAsync(async (req, res, next) => {
  const post = await ForumPost.findById(req.params.id);

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  post.comments.push({
    user: req.user._id,
    text: req.body.text,
  });

  await post.save();

  const populated = await ForumPost.findById(post._id)
    .populate('user', 'name role')
    .populate('comments.user', 'name');

  res.status(201).json({
    status: 'success',
    post: populated,
  });
});

const toggleLike = catchAsync(async (req, res, next) => {
  const post = await ForumPost.findById(req.params.id);

  if (!post) {
    return next(new AppError('Post not found', 404));
  }

  const exists = post.likes.some((id) => String(id) === String(req.user._id));

  if (exists) {
    post.likes = post.likes.filter((id) => String(id) !== String(req.user._id));
  } else {
    post.likes.push(req.user._id);
  }

  await post.save();

  res.status(200).json({
    status: 'success',
    likes: post.likes.length,
    liked: !exists,
  });
});

module.exports = {
  createPost,
  listPosts,
  addComment,
  toggleLike,
};
