import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  appendIncomingMessage,
  applyThreadUpdate,
  fetchChatContacts,
  fetchChatMessages,
  fetchChats,
  markChatRead,
  openChat,
  sendChatMessage,
  setActiveChatId,
} from '../features/chat/chatSlice';
import usePageTitle from '../hooks/usePageTitle';
import { getSocket } from '../utils/socket';
import { ClockIcon, MessageCircleIcon, SearchIcon, SendIcon, UserGroupIcon } from '../components/icons/AppIcons';

const formatTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getSenderIdFromMessage = (message) => {
  if (!message?.sender) return '';
  return typeof message.sender === 'object' ? message.sender._id || '' : message.sender;
};

const ChatPage = () => {
  usePageTitle('Chat');

  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const { user, token } = useAppSelector((state) => state.auth);
  const {
    chats,
    contacts,
    messagesByChat,
    messagesMetaByChat,
    activeChatId,
    loading,
    contactsLoading,
    messagesLoading,
    sending,
  } = useAppSelector((state) => state.chat);

  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [typingByChat, setTypingByChat] = useState({});
  const [socketConnected, setSocketConnected] = useState(false);
  const bottomRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const typingCleanupRef = useRef(new Map());
  const isTypingRef = useRef(false);
  const readSyncTimeoutRef = useRef(null);

  const activeChat = useMemo(() => chats.find((chat) => chat._id === activeChatId), [activeChatId, chats]);
  const activeMessages = messagesByChat[activeChatId] || [];
  const activeMeta = messagesMetaByChat[activeChatId] || { page: 1, hasMore: false };
  const activeTypingNames = useMemo(() => {
    if (!activeChatId) return [];

    const participantMap = new Map(
      (activeChat?.participants || []).map((participant) => [participant._id, participant.name || 'Someone']),
    );
    const typingIds = typingByChat[activeChatId] || [];

    return [...new Set(typingIds.map((id) => participantMap.get(id) || 'Someone'))];
  }, [activeChat?.participants, activeChatId, typingByChat]);

  const filteredChats = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.trim().toLowerCase();
    return chats.filter((chat) => {
      const other = (chat.participants || []).find((participant) => participant._id !== user?._id);
      const inName = other?.name?.toLowerCase().includes(q);
      const inRole = other?.role?.toLowerCase().includes(q);
      const inLastMessage = chat.lastMessagePreview?.toLowerCase().includes(q);
      return inName || inRole || inLastMessage;
    });
  }, [chats, search, user?._id]);

  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      const inName = contact.name?.toLowerCase().includes(q);
      const inRole = contact.role?.toLowerCase().includes(q);
      const inDistrict = contact.location?.district?.toLowerCase().includes(q);
      return inName || inRole || inDistrict;
    });
  }, [contacts, search]);

  useEffect(() => {
    dispatch(fetchChats());
    dispatch(fetchChatContacts());
  }, [dispatch]);

  const stopTyping = useCallback(
    (chatId = activeChatId) => {
      if (!chatId || !user?._id) return;

      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }

      if (isTypingRef.current) {
        const socket = getSocket({ userId: user._id, token });
        socket.emit('typing:stop', { chatId });
      }

      isTypingRef.current = false;
    },
    [activeChatId, token, user?._id],
  );

  const queueMarkRead = useCallback(
    (chatId) => {
      if (!chatId) return;
      if (readSyncTimeoutRef.current) {
        clearTimeout(readSyncTimeoutRef.current);
      }

      readSyncTimeoutRef.current = setTimeout(() => {
        dispatch(markChatRead(chatId));
        readSyncTimeoutRef.current = null;
      }, 220);
    },
    [dispatch],
  );

  useEffect(() => {
    if (!user?._id) return;

    const socket = getSocket({ userId: user._id, token });

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onConnectError = () => setSocketConnected(false);

    const onIncomingMessage = (payload) => {
      const incomingChatId = payload?.chatId;
      const senderId = getSenderIdFromMessage(payload?.message);
      dispatch(appendIncomingMessage(payload));

      if (
        incomingChatId &&
        incomingChatId === activeChatId &&
        senderId &&
        senderId !== user._id
      ) {
        queueMarkRead(incomingChatId);
      }
    };

    const onThreadUpdated = (payload) => {
      dispatch(applyThreadUpdate(payload));
    };

    const onChatRead = (payload) => {
      if (payload?.userId === user?._id) {
        dispatch(applyThreadUpdate(payload));
      }
    };

    const removeTyping = (chatId, typingUserId) => {
      setTypingByChat((prev) => {
        const current = prev[chatId] || [];
        const filtered = current.filter((id) => id !== typingUserId);
        if (filtered.length === current.length) return prev;
        if (!filtered.length) {
          const next = { ...prev };
          delete next[chatId];
          return next;
        }
        return { ...prev, [chatId]: filtered };
      });
    };

    const onTypingStart = ({ chatId, userId: typingUserId } = {}) => {
      if (!chatId || !typingUserId || typingUserId === user._id) return;

      setTypingByChat((prev) => {
        const current = prev[chatId] || [];
        if (current.includes(typingUserId)) return prev;
        return { ...prev, [chatId]: [...current, typingUserId] };
      });

      const timeoutKey = `${chatId}:${typingUserId}`;
      const existingTimeout = typingCleanupRef.current.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeoutId = setTimeout(() => {
        removeTyping(chatId, typingUserId);
        typingCleanupRef.current.delete(timeoutKey);
      }, 2800);

      typingCleanupRef.current.set(timeoutKey, timeoutId);
    };

    const onTypingStop = ({ chatId, userId: typingUserId } = {}) => {
      if (!chatId || !typingUserId || typingUserId === user._id) return;

      const timeoutKey = `${chatId}:${typingUserId}`;
      const activeTimeout = typingCleanupRef.current.get(timeoutKey);
      if (activeTimeout) {
        clearTimeout(activeTimeout);
      }
      typingCleanupRef.current.delete(timeoutKey);
      removeTyping(chatId, typingUserId);
    };

    setSocketConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('chat:message', onIncomingMessage);
    socket.on('chat:thread-updated', onThreadUpdated);
    socket.on('chat:read', onChatRead);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('chat:message', onIncomingMessage);
      socket.off('chat:thread-updated', onThreadUpdated);
      socket.off('chat:read', onChatRead);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
  }, [activeChatId, dispatch, queueMarkRead, token, user?._id]);

  useEffect(() => {
    if (!activeChatId || !user?._id) return;

    const socket = getSocket({ userId: user._id, token });
    socket.emit('join:chat', activeChatId);

    dispatch(fetchChatMessages({ chatId: activeChatId, page: 1, limit: 50 }));
    dispatch(markChatRead(activeChatId));

    return () => {
      stopTyping(activeChatId);
      socket.emit('leave:chat', activeChatId);
    };
  }, [activeChatId, dispatch, stopTyping, token, user?._id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChatId, activeMessages.length]);

  useEffect(
    () => () => {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
      }
      if (readSyncTimeoutRef.current) {
        clearTimeout(readSyncTimeoutRef.current);
      }
      typingCleanupRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      typingCleanupRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const params = new URLSearchParams(searchParamsKey);
    const chatId = params.get('chatId');
    const participantId = params.get('participantId');

    if (chatId) {
      dispatch(setActiveChatId(chatId));
      return;
    }

    if (participantId) {
      dispatch(openChat({ participantId }))
        .unwrap()
        .then(() => dispatch(fetchChatContacts()))
        .catch((errorMessage) => toast.error(errorMessage || 'Failed to open chat'));
    }
  }, [dispatch, searchParamsKey]);

  const onStartChatWithContact = async (participantId) => {
    const action = await dispatch(openChat({ participantId }));
    if (openChat.fulfilled.match(action)) {
      dispatch(fetchChatContacts());
      toast.success('Chat opened');
    } else {
      toast.error(action.payload || 'Failed to open chat');
    }
  };

  const onSendMessage = async (event) => {
    event.preventDefault();
    if (!message.trim() || !activeChatId) return;
    stopTyping(activeChatId);

    const action = await dispatch(sendChatMessage({ chatId: activeChatId, text: message.trim() }));
    if (sendChatMessage.fulfilled.match(action)) {
      setMessage('');
    } else {
      toast.error(action.payload || 'Failed to send message');
    }
  };

  const onMessageInputChange = (event) => {
    const nextValue = event.target.value;
    setMessage(nextValue);

    if (!activeChatId || !user?._id) return;
    const socket = getSocket({ userId: user._id, token });
    const hasText = Boolean(nextValue.trim());

    if (!hasText) {
      stopTyping(activeChatId);
      return;
    }

    if (!isTypingRef.current) {
      socket.emit('typing:start', { chatId: activeChatId });
      isTypingRef.current = true;
    }

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { chatId: activeChatId });
      isTypingRef.current = false;
      typingStopTimeoutRef.current = null;
    }, 1200);
  };

  const loadOlderMessages = () => {
    if (!activeChatId) return;
    dispatch(
      fetchChatMessages({
        chatId: activeChatId,
        page: (activeMeta.page || 1) + 1,
        limit: 50,
        append: true,
      }),
    );
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_2fr]">
      <aside className="app-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">Messages</h1>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                socketConnected
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {socketConnected ? 'Live' : 'Reconnecting'}
            </span>
          </div>
          <MessageCircleIcon className="h-5 w-5 text-[var(--accent)]" />
        </div>

        <div className="mt-3">
          <label className="relative block">
            <SearchIcon className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats or contacts"
              className="input pl-9"
            />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <UserGroupIcon className="h-4 w-4 text-[var(--accent)]" />
            <p className="text-sm font-semibold">Suggested Contacts</p>
          </div>
          <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {contactsLoading && <p className="text-xs text-[var(--text-muted)]">Loading contacts...</p>}
            {!contactsLoading &&
              filteredContacts.slice(0, 10).map((contact) => (
                <button
                  key={contact._id}
                  type="button"
                  onClick={() => onStartChatWithContact(contact._id)}
                  className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-left text-sm hover:bg-[var(--bg-soft)]"
                >
                  <p className="font-semibold">{contact.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {contact.role} | {contact.location?.district || 'N/A'}
                  </p>
                </button>
              ))}
            {!contactsLoading && !filteredContacts.length && (
              <p className="text-xs text-[var(--text-muted)]">
                Contacts appear after orders, subscriptions, or existing chats.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Threads</p>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {loading && <p className="text-xs text-[var(--text-muted)]">Loading chats...</p>}
            {!loading &&
              filteredChats.map((chat) => {
                const other = (chat.participants || []).find((participant) => participant._id !== user?._id);

                return (
                  <button
                    key={chat._id}
                    type="button"
                    onClick={() => dispatch(setActiveChatId(chat._id))}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      chat._id === activeChatId
                        ? 'border-[var(--accent)] bg-[var(--bg-soft)]'
                        : 'border-[var(--line)] hover:bg-[var(--bg-soft)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 font-semibold">{other?.name || 'Conversation'}</p>
                      {chat.unreadCount > 0 && (
                        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="line-clamp-1 text-xs text-[var(--text-muted)]">
                      {chat.lastMessagePreview || 'No messages yet'}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--text-muted)]">{formatTime(chat.lastMessageAt)}</p>
                  </button>
                );
              })}
            {!loading && !filteredChats.length && (
              <p className="text-xs text-[var(--text-muted)]">No conversations yet.</p>
            )}
          </div>
        </div>
      </aside>

      <section className="app-card flex h-[74vh] flex-col p-4">
        <div className="border-b border-[var(--line)] pb-3">
          <h2 className="text-lg font-bold">{activeChat ? 'Conversation' : 'Select a conversation'}</h2>
          {activeChat && (
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="h-3.5 w-3.5" /> Updated {formatTime(activeChat.lastMessageAt)}
              </span>
              {activeChat.context?.subject && (
                <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[10px]">
                  {activeChat.context.subject}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-xl border border-[var(--line)] p-3">
          {activeChat && activeMeta.hasMore && (
            <button
              type="button"
              className="btn-secondary mx-auto block"
              onClick={loadOlderMessages}
              disabled={messagesLoading}
            >
              {messagesLoading ? 'Loading...' : 'Load older messages'}
            </button>
          )}

          {!activeChat && <p className="text-sm text-[var(--text-muted)]">Choose a thread or start from contacts.</p>}

          {activeChat &&
            activeMessages.map((entry) => {
              const senderId = getSenderIdFromMessage(entry);
              const mine = senderId === user?._id;

              return (
                <div key={entry._id || `${senderId}-${entry.createdAt}`} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[78%] rounded-xl px-3 py-2 text-sm ${
                      mine ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-soft)] text-[var(--text)]'
                    }`}
                  >
                    <p>{entry.text}</p>
                    <p className={`mt-1 text-[10px] ${mine ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                      {formatTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          {activeChat && activeTypingNames.length > 0 && (
            <p className="text-xs text-[var(--accent)]">
              {activeTypingNames.join(', ')} {activeTypingNames.length === 1 ? 'is' : 'are'} typing...
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={onSendMessage} className="mt-3 flex gap-2">
          <input
            value={message}
            onChange={onMessageInputChange}
            placeholder={activeChat ? 'Type your message' : 'Select a conversation first'}
            className="input flex-1"
            disabled={!activeChat || sending}
          />
          <button
            type="submit"
            className="btn-primary inline-flex items-center gap-2"
            disabled={!activeChat || sending || !message.trim()}
          >
            <SendIcon className="h-4 w-4" />
            {sending ? 'Sending' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default ChatPage;
