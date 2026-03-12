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
import { ArrowRightIcon, BoltIcon, MessageCircleIcon, SearchIcon, SendIcon, ShieldCheckIcon, StoreIcon, UserGroupIcon } from '../components/icons/AppIcons';

const formatTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTimeShort = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDayLabel = (value) => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const toDayKey = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((toDayKey(now) - toDayKey(date)) / 86400000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

const getSenderIdFromMessage = (message) => {
  if (!message?.sender) return '';
  return typeof message.sender === 'object' ? message.sender._id || '' : message.sender;
};

const getOtherParticipant = (chat, userId) =>
  (chat?.participants || []).find((participant) => participant._id !== userId) || null;

const getInitials = (value) => {
  const words = String(value || '')
    .split(' ')
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) return 'KH';
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
};

const QUICK_REPLIES = {
  farmer: ['Can you share fresh stock status?', 'What is your best rate today?', 'Need delivery timeline please'],
  buyer: ['Stock is available today', 'I can arrange dispatch quickly', 'Sharing final quote in a moment'],
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
  const [mobilePane, setMobilePane] = useState('list');
  const bottomRef = useRef(null);
  const messageInputRef = useRef(null);
  const typingStopTimeoutRef = useRef(null);
  const typingCleanupRef = useRef(new Map());
  const isTypingRef = useRef(false);
  const readSyncTimeoutRef = useRef(null);

  const activeChat = useMemo(() => chats.find((chat) => chat._id === activeChatId), [activeChatId, chats]);
  const activeParticipant = useMemo(() => getOtherParticipant(activeChat, user?._id), [activeChat, user?._id]);
  const activeMessages = messagesByChat[activeChatId] || [];
  const activeMeta = messagesMetaByChat[activeChatId] || { page: 1, hasMore: false };

  const messageRows = useMemo(() => {
    let previousLabel = '';

    return activeMessages.map((entry) => {
      const dayLabel = formatDayLabel(entry.createdAt);
      const showDayLabel = Boolean(dayLabel && dayLabel !== previousLabel);
      previousLabel = dayLabel;

      return { entry, dayLabel, showDayLabel };
    });
  }, [activeMessages]);

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
      const other = getOtherParticipant(chat, user?._id);
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

  const quickReplies = useMemo(
    () => QUICK_REPLIES[activeParticipant?.role === 'farmer' ? 'farmer' : 'buyer'],
    [activeParticipant?.role],
  );

  const recentHighlights = useMemo(() => activeMessages.slice(-4).reverse(), [activeMessages]);

  const actionCards = useMemo(
    () => [
      { key: 'order', label: 'Create order', subtitle: 'Start a fresh order flow', icon: StoreIcon },
      { key: 'quote', label: 'Request quote', subtitle: 'Ask for updated pricing', icon: BoltIcon },
      { key: 'verified', label: 'Verify farmer', subtitle: 'Review verification status', icon: ShieldCheckIcon },
    ],
    [],
  );

  const runAction = (label) => {
    toast.success(`${label} queued`);
  };

  useEffect(() => {
    if (activeChatId) {
      setMobilePane('chat');
    }
  }, [activeChatId]);

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

      if (incomingChatId && incomingChatId === activeChatId && senderId && senderId !== user._id) {
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
      setMobilePane('chat');
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

  const onUseQuickReply = (value) => {
    if (!activeChatId) return;
    setMessage(value);
    messageInputRef.current?.focus();
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
    <div className="space-y-3">
      <div className="chat-mobile-switch xl:hidden">
        <button
          type="button"
          onClick={() => setMobilePane('list')}
          className={`chat-mobile-switch-btn ${mobilePane === 'list' ? 'active' : ''}`}
        >
          Threads
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('chat')}
          className={`chat-mobile-switch-btn ${mobilePane === 'chat' ? 'active' : ''}`}
          disabled={!activeChatId}
        >
          Conversation
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)_18rem]">
      <aside className={`chat-sidebar app-card p-0 ${mobilePane === 'chat' ? 'chat-hide-mobile' : ''}`}>
        <div className="chat-sidebar-header">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-bold">Conversations</h1>
              <p className="text-xs text-[var(--text-muted)]">Farmer and buyer real-time workspace</p>
            </div>
            <span className={`chat-connection-pill ${socketConnected ? 'online' : 'offline'}`}>
              <span className="chat-connection-dot" />
              {socketConnected ? 'Live' : 'Reconnecting'}
            </span>
          </div>

          <label className="relative mt-3 block">
            <SearchIcon className="input-leading-icon" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people, role, district"
              className="input input-with-icon"
            />
          </label>
        </div>

        <div className="chat-sidebar-body">
          <section className="chat-block">
            <div className="chat-block-title-row">
              <p className="chat-block-title">Suggested Contacts</p>
              <UserGroupIcon className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <div className="chat-list-scroll">
              {contactsLoading && <p className="chat-empty-state">Loading contacts...</p>}
              {!contactsLoading &&
                filteredContacts.slice(0, 12).map((contact) => (
                  <button
                    key={contact._id}
                    type="button"
                    onClick={() => onStartChatWithContact(contact._id)}
                    className="chat-contact-card"
                  >
                    <span className="chat-avatar">{getInitials(contact.name)}</span>
                    <span className="chat-contact-copy">
                      <span className="chat-contact-name">{contact.name}</span>
                      <span className="chat-contact-meta">
                        {contact.role} | {contact.location?.district || 'N/A'}
                      </span>
                    </span>
                  </button>
                ))}
              {!contactsLoading && !filteredContacts.length && (
                <p className="chat-empty-state">Contacts appear after orders, subscriptions, or existing chats.</p>
              )}
            </div>
          </section>

          <section className="chat-block">
            <div className="chat-block-title-row">
              <p className="chat-block-title">Threads</p>
              <span className="badge">{filteredChats.length}</span>
            </div>
            <div className="chat-list-scroll">
              {loading && <p className="chat-empty-state">Loading chats...</p>}
              {!loading &&
                filteredChats.map((chat) => {
                  const other = getOtherParticipant(chat, user?._id);

                  return (
                    <button
                      key={chat._id}
                      type="button"
                      onClick={() => {
                        dispatch(setActiveChatId(chat._id));
                        setMobilePane('chat');
                      }}
                      className={`chat-thread-card ${chat._id === activeChatId ? 'active' : ''}`}
                    >
                      <span className="chat-avatar">{getInitials(other?.name)}</span>
                      <span className="chat-thread-copy">
                        <span className="chat-thread-head">
                          <span className="chat-thread-name">{other?.name || 'Conversation'}</span>
                          <span className="chat-thread-time">{formatTimeShort(chat.lastMessageAt)}</span>
                        </span>
                        <span className="chat-thread-preview">{chat.lastMessagePreview || 'No messages yet'}</span>
                      </span>
                      {chat.unreadCount > 0 && <span className="chat-thread-unread">{chat.unreadCount}</span>}
                    </button>
                  );
                })}
              {!loading && !filteredChats.length && <p className="chat-empty-state">No conversations yet.</p>}
            </div>
          </section>
        </div>
      </aside>

      <section className={`chat-shell app-card p-0 ${mobilePane === 'list' ? 'chat-hide-mobile' : ''}`}>
        <header className="chat-header">
          {activeChat ? (
            <>
              <button type="button" className="chat-mobile-back xl:hidden" onClick={() => setMobilePane('list')}>
                <ArrowRightIcon className="h-3.5 w-3.5 rotate-180" />
                Threads
              </button>
              <span className="chat-avatar">{getInitials(activeParticipant?.name)}</span>
              <div className="chat-header-copy">
                <h2 className="chat-header-title">{activeParticipant?.name || 'Conversation'}</h2>
                <p className="chat-header-meta">
                  {activeParticipant?.role || 'participant'}
                  <span className="chat-dot">|</span>
                  Updated {formatTime(activeChat.lastMessageAt)}
                </p>
              </div>
              <div className="chat-header-right">
                {activeChat.context?.subject ? <span className="badge">{activeChat.context.subject}</span> : null}
                <span className={`chat-connection-pill ${socketConnected ? 'online' : 'offline'}`}>
                  <span className="chat-connection-dot" />
                  {socketConnected ? 'Connected' : 'Syncing'}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="chat-avatar">KH</span>
              <div className="chat-header-copy">
                <h2 className="chat-header-title">Select a conversation</h2>
                <p className="chat-header-meta">Start from contacts or open a previous thread</p>
              </div>
            </>
          )}
        </header>

        <div className="chat-message-area">
          {activeChat && activeMeta.hasMore && (
            <button type="button" className="btn-secondary mx-auto" onClick={loadOlderMessages} disabled={messagesLoading}>
              {messagesLoading ? 'Loading...' : 'Load older messages'}
            </button>
          )}

          {!activeChat && <p className="chat-empty-message">Choose a thread to start messaging.</p>}

          {activeChat &&
            messageRows.map(({ entry, dayLabel, showDayLabel }) => {
              const senderId = getSenderIdFromMessage(entry);
              const mine = senderId === user?._id;
              const senderName =
                typeof entry.sender === 'object'
                  ? entry.sender?.name || activeParticipant?.name || 'Participant'
                  : mine
                    ? user?.name || 'You'
                    : activeParticipant?.name || 'Participant';

              return (
                <div key={entry._id || `${senderId}-${entry.createdAt}`}>
                  {showDayLabel ? <div className="chat-day-divider">{dayLabel}</div> : null}
                  <div className={`chat-bubble-row ${mine ? 'mine' : ''}`}>
                    {!mine && <span className="chat-avatar tiny">{getInitials(senderName)}</span>}
                    <article className={`chat-bubble ${mine ? 'mine' : ''}`}>
                      {!mine ? <p className="chat-bubble-author">{senderName}</p> : null}
                      <p className="chat-bubble-text">{entry.text}</p>
                      <p className="chat-bubble-time">{formatTime(entry.createdAt)}</p>
                    </article>
                  </div>
                </div>
              );
            })}

          {activeChat && activeTypingNames.length > 0 && (
            <div className="chat-typing-indicator">
              <span className="chat-typing-dots">
                <i />
                <i />
                <i />
              </span>
              <span>
                {activeTypingNames.join(', ')} {activeTypingNames.length === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {activeChat && (
          <div className="chat-quick-replies">
            {quickReplies.map((quickReply) => (
              <button key={quickReply} type="button" className="chat-quick-reply-pill" onClick={() => onUseQuickReply(quickReply)}>
                {quickReply}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSendMessage} className="chat-compose">
          <label className="relative flex-1">
            <MessageCircleIcon className="input-leading-icon" />
            <input
              ref={messageInputRef}
              value={message}
              onChange={onMessageInputChange}
              placeholder={activeChat ? 'Type your message' : 'Select a conversation first'}
              className="input input-with-icon"
              disabled={!activeChat || sending}
            />
          </label>
          <button type="submit" className="btn-primary chat-send-button" disabled={!activeChat || sending || !message.trim()}>
            <SendIcon className="h-4 w-4" />
            {sending ? 'Sending' : 'Send'}
          </button>
        </form>
      </section>

      <aside className="chat-insights app-card p-4 hidden 2xl:flex">
        <div className="chat-insights-block">
          <p className="chat-insights-title">Conversation intel</p>
          <p className="chat-insights-subtitle">Live context for this buyer-farmer thread.</p>
          <div className="chat-insights-metrics">
            <div>
              <p className="chat-insights-label">Status</p>
              <p className="chat-insights-value">{activeChat ? 'Active' : 'Idle'}</p>
            </div>
            <div>
              <p className="chat-insights-label">Last activity</p>
              <p className="chat-insights-value">{activeChat ? formatTimeShort(activeChat.lastMessageAt) : '-'}</p>
            </div>
            <div>
              <p className="chat-insights-label">Participants</p>
              <p className="chat-insights-value">{activeChat?.participants?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="chat-insights-block">
          <p className="chat-insights-title">Smart actions</p>
          <div className="chat-action-grid">
            {actionCards.map((action) => (
              <button key={action.key} type="button" className="chat-action-card" onClick={() => runAction(action.label)}>
                <span className="chat-action-icon">
                  <action.icon className="h-4 w-4" />
                </span>
                <span className="chat-action-copy">
                  <span className="chat-action-title">{action.label}</span>
                  <span className="chat-action-subtitle">{action.subtitle}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="chat-insights-block">
          <p className="chat-insights-title">Recent highlights</p>
          <div className="chat-highlights">
            {recentHighlights.length ? (
              recentHighlights.map((entry) => (
                <div key={entry._id || entry.createdAt} className="chat-highlight-item">
                  <p className="chat-highlight-text">{entry.text}</p>
                  <span className="chat-highlight-time">{formatTimeShort(entry.createdAt)}</span>
                </div>
              ))
            ) : (
              <p className="chat-insights-empty">Start messaging to see highlights.</p>
            )}
          </div>
        </div>
      </aside>
      </div>
    </div>
  );
};

export default ChatPage;

