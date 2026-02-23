import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { addForumComment, createForumPost, fetchForumPosts, toggleForumLike } from '../features/forum/forumSlice';
import usePageTitle from '../hooks/usePageTitle';

const ForumPage = () => {
  usePageTitle('Community Forum');

  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { posts } = useAppSelector((state) => state.forum);

  const [search, setSearch] = useState('');
  const [newPost, setNewPost] = useState({ title: '', content: '', tags: '' });
  const [commentMap, setCommentMap] = useState({});

  useEffect(() => {
    dispatch(fetchForumPosts(''));
  }, [dispatch]);

  const submitPost = async (event) => {
    event.preventDefault();

    const payload = {
      title: newPost.title,
      content: newPost.content,
      tags: newPost.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    await dispatch(createForumPost(payload));
    setNewPost({ title: '', content: '', tags: '' });
  };

  return (
    <div className="space-y-5">
      <section className="app-card bg-gradient-to-r from-[#3a5f2d] to-[#7cae47] p-6 text-white">
        <h1 className="text-3xl font-bold">Community Discussion Forum</h1>
        <p className="mt-2 text-sm text-white/90">Ask questions, share farming best practices, and discuss market trends.</p>
      </section>

      <section className="app-card p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search forum posts"
            className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2"
          />
          <button
            type="button"
            onClick={() => dispatch(fetchForumPosts(search))}
            className="rounded-xl border border-[var(--line)] px-4 py-2 text-sm"
          >
            Search
          </button>
        </div>
      </section>

      {user && (
        <section className="app-card p-4">
          <h2 className="text-xl font-bold">Create Post</h2>
          <form onSubmit={submitPost} className="mt-3 space-y-3">
            <input
              value={newPost.title}
              onChange={(event) => setNewPost((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Post title"
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2"
              required
            />
            <textarea
              value={newPost.content}
              onChange={(event) => setNewPost((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Share your discussion point"
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2"
              rows="3"
              required
            />
            <input
              value={newPost.tags}
              onChange={(event) => setNewPost((prev) => ({ ...prev, tags: event.target.value }))}
              placeholder="Tags (comma separated)"
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2"
            />
            <button type="submit" className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white">
              Post
            </button>
          </form>
        </section>
      )}

      <section className="space-y-4">
        {posts.map((post) => (
          <article key={post._id} className="app-card p-4">
            <h3 className="text-xl font-semibold">{post.title}</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              By {post.user?.name || 'User'} | {new Date(post.createdAt).toLocaleString()}
            </p>
            <p className="mt-3 text-sm">{post.content}</p>

            <div className="mt-3 flex flex-wrap gap-2">
              {(post.tags || []).map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--line)] px-2 py-1 text-xs">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => dispatch(toggleForumLike(post._id)).then(() => dispatch(fetchForumPosts(search)))}
                className="rounded-lg border border-[var(--line)] px-3 py-1 text-sm"
              >
                Like ({post.likes?.length || 0})
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-[var(--line)] p-3">
              <p className="text-sm font-semibold">Comments ({post.comments?.length || 0})</p>

              {(post.comments || []).map((comment) => (
                <div key={comment._id} className="rounded-lg bg-[var(--bg-soft)] px-3 py-2 text-sm">
                  <p className="font-semibold">{comment.user?.name || 'User'}</p>
                  <p>{comment.text}</p>
                </div>
              ))}

              {user && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    const text = commentMap[post._id];
                    if (!text?.trim()) return;
                    dispatch(addForumComment({ id: post._id, text })).then(() => dispatch(fetchForumPosts(search)));
                    setCommentMap((prev) => ({ ...prev, [post._id]: '' }));
                  }}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <input
                    value={commentMap[post._id] || ''}
                    onChange={(event) => setCommentMap((prev) => ({ ...prev, [post._id]: event.target.value }))}
                    placeholder="Write a comment"
                    className="flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm"
                  />
                  <button type="submit" className="rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
                    Comment
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default ForumPage;
