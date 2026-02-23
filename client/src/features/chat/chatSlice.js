import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import api from '../../api/client';

const initialState = {
  chats: [],
  contacts: [],
  messagesByChat: {},
  messagesMetaByChat: {},
  activeChatId: null,
  loading: false,
  contactsLoading: false,
  messagesLoading: false,
  sending: false,
  error: null,
};

const byRecentMessage = (a, b) => {
  const aTime = a?.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
  const bTime = b?.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
  return bTime - aTime;
};

const mergeDefinedFields = (source, updates) => {
  const next = { ...source };
  Object.entries(updates).forEach(([key, value]) => {
    if (typeof value !== 'undefined') {
      next[key] = value;
    }
  });
  return next;
};

const upsertChatSummary = (chats, incomingChat) => {
  if (!incomingChat?._id) return chats;

  const exists = chats.some((chat) => chat._id === incomingChat._id);
  const next = exists
    ? chats.map((chat) =>
        chat._id === incomingChat._id ? mergeDefinedFields(chat, incomingChat) : chat,
      )
    : [incomingChat, ...chats];

  return [...next].sort(byRecentMessage);
};

const normalizeSenderId = (sender) => {
  if (!sender) return '';
  return typeof sender === 'object' && sender?._id ? String(sender._id) : String(sender);
};

const messageSortValue = (message) => {
  if (!message?.createdAt) return 0;
  const value = new Date(message.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
};

const messageKey = (message) => {
  if (message?._id) return String(message._id);
  return `${normalizeSenderId(message?.sender)}|${message?.createdAt || ''}|${message?.text || ''}`;
};

const preferRicherMessage = (current, incoming) => {
  const currentHasSenderObj = Boolean(current?.sender && typeof current.sender === 'object' && current.sender._id);
  const incomingHasSenderObj = Boolean(
    incoming?.sender && typeof incoming.sender === 'object' && incoming.sender._id,
  );

  if (incomingHasSenderObj && !currentHasSenderObj) return incoming;
  if (currentHasSenderObj && !incomingHasSenderObj) return current;

  const currentReadBy = current?.readBy?.length || 0;
  const incomingReadBy = incoming?.readBy?.length || 0;
  return incomingReadBy >= currentReadBy ? incoming : current;
};

const mergeMessages = (currentMessages = [], incomingMessages = []) => {
  const merged = new Map();

  [...currentMessages, ...incomingMessages].forEach((message) => {
    if (!message) return;
    const key = messageKey(message);

    if (!merged.has(key)) {
      merged.set(key, message);
      return;
    }

    merged.set(key, preferRicherMessage(merged.get(key), message));
  });

  return [...merged.values()].sort((a, b) => {
    const timeDiff = messageSortValue(a) - messageSortValue(b);
    if (timeDiff !== 0) return timeDiff;
    return String(a?._id || '').localeCompare(String(b?._id || ''));
  });
};

const applyThreadToContacts = (contacts, thread) => {
  if (!thread?.chatId) return contacts;

  return contacts.map((contact) =>
    contact.chatId === thread.chatId
      ? {
          ...contact,
          ...(typeof thread.lastMessagePreview !== 'undefined'
            ? { lastMessagePreview: thread.lastMessagePreview }
            : {}),
          ...(typeof thread.lastMessageAt !== 'undefined' ? { lastMessageAt: thread.lastMessageAt } : {}),
          ...(typeof thread.unreadCount === 'number' ? { unreadCount: thread.unreadCount } : {}),
        }
      : contact,
  );
};

const upsertMessage = (messages, message) => {
  return mergeMessages(messages, [message]);
};

export const fetchChats = createAsyncThunk('chat/fetchChats', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/chats');
    return data.chats || [];
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load chats');
  }
});

export const fetchChatContacts = createAsyncThunk('chat/fetchChatContacts', async (_, thunkAPI) => {
  try {
    const { data } = await api.get('/chats/contacts');
    return data.contacts || [];
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load chat contacts');
  }
});

export const openChat = createAsyncThunk('chat/openChat', async (payload, thunkAPI) => {
  try {
    const body =
      typeof payload === 'string'
        ? { participantId: payload }
        : {
            participantId: payload.participantId,
            ...(payload.productId ? { productId: payload.productId } : {}),
            ...(payload.initialMessage ? { initialMessage: payload.initialMessage } : {}),
          };

    const { data } = await api.post('/chats', body);
    return data.chat;
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to open chat');
  }
});

export const fetchChatMessages = createAsyncThunk(
  'chat/fetchChatMessages',
  async ({ chatId, page = 1, limit = 40, append = false }, thunkAPI) => {
    try {
      const { data } = await api.get(`/chats/${chatId}/messages`, { params: { page, limit } });
      return {
        chatId,
        page: data.page,
        limit: data.limit,
        totalMessages: data.totalMessages,
        hasMore: data.hasMore,
        append,
        messages: data.messages || [],
        chat: data.chat,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to load messages');
    }
  },
);

export const markChatRead = createAsyncThunk('chat/markChatRead', async (chatId, thunkAPI) => {
  try {
    const { data } = await api.patch(`/chats/${chatId}/read`);
    return { chatId, unreadCount: data.unreadCount ?? 0 };
  } catch (error) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to mark chat read');
  }
});

export const sendChatMessage = createAsyncThunk(
  'chat/sendChatMessage',
  async ({ chatId, text }, thunkAPI) => {
    try {
      const { data } = await api.post(`/chats/${chatId}/messages`, { text });
      return {
        chatId,
        message: data.message,
        thread: data.thread,
      };
    } catch (error) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Failed to send message');
    }
  },
);

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setActiveChatId: (state, action) => {
      state.activeChatId = action.payload;
    },
    appendIncomingMessage: (state, action) => {
      const { chatId, message, thread } = action.payload || {};
      if (!chatId || !message) return;

      const currentMessages = state.messagesByChat[chatId] || [];
      state.messagesByChat[chatId] = upsertMessage(currentMessages, message);

      const mergedThread = {
        chatId,
        lastMessagePreview: thread?.lastMessagePreview || message.text || '',
        lastMessageSender: thread?.lastMessageSender || message.sender,
        lastMessageAt: thread?.lastMessageAt || message.createdAt || new Date().toISOString(),
      };

      if (thread) {
        state.chats = upsertChatSummary(state.chats, {
          _id: chatId,
          lastMessagePreview: mergedThread.lastMessagePreview,
          lastMessageSender: mergedThread.lastMessageSender,
          lastMessageAt: mergedThread.lastMessageAt,
        });
      } else {
        state.chats = upsertChatSummary(state.chats, {
          _id: chatId,
          lastMessagePreview: mergedThread.lastMessagePreview,
          lastMessageSender: mergedThread.lastMessageSender,
          lastMessageAt: mergedThread.lastMessageAt,
        });
      }

      state.contacts = applyThreadToContacts(state.contacts, mergedThread);
    },
    applyThreadUpdate: (state, action) => {
      const thread = action.payload;
      if (!thread?.chatId) return;
      state.chats = upsertChatSummary(state.chats, {
        _id: thread.chatId,
        ...(typeof thread.lastMessagePreview !== 'undefined'
          ? { lastMessagePreview: thread.lastMessagePreview }
          : {}),
        ...(typeof thread.lastMessageSender !== 'undefined'
          ? { lastMessageSender: thread.lastMessageSender }
          : {}),
        ...(typeof thread.lastMessageAt !== 'undefined' ? { lastMessageAt: thread.lastMessageAt } : {}),
        ...(typeof thread.unreadCount === 'number' ? { unreadCount: thread.unreadCount } : {}),
      });
      state.contacts = applyThreadToContacts(state.contacts, thread);
    },
    clearChatState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.loading = false;
        state.chats = [...action.payload].sort(byRecentMessage);

        if (!state.activeChatId && state.chats.length) {
          state.activeChatId = state.chats[0]._id;
        }
      })
      .addCase(fetchChats.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchChatContacts.pending, (state) => {
        state.contactsLoading = true;
      })
      .addCase(fetchChatContacts.fulfilled, (state, action) => {
        state.contactsLoading = false;
        state.contacts = action.payload;
      })
      .addCase(fetchChatContacts.rejected, (state) => {
        state.contactsLoading = false;
      })
      .addCase(openChat.fulfilled, (state, action) => {
        state.chats = upsertChatSummary(state.chats, action.payload);
        state.activeChatId = action.payload._id;
      })
      .addCase(fetchChatMessages.pending, (state) => {
        state.messagesLoading = true;
      })
      .addCase(fetchChatMessages.fulfilled, (state, action) => {
        state.messagesLoading = false;
        const { chatId, messages, append, page, hasMore, totalMessages, chat } = action.payload;
        const existing = state.messagesByChat[chatId] || [];

        state.messagesByChat[chatId] = mergeMessages(existing, messages);

        const previousMeta = state.messagesMetaByChat[chatId] || {};
        const nextPage = append ? Math.max(previousMeta.page || 1, page) : page;

        state.messagesMetaByChat[chatId] = {
          page: nextPage,
          hasMore,
          totalMessages,
        };

        if (chat?._id) {
          state.chats = upsertChatSummary(state.chats, chat);
          state.contacts = applyThreadToContacts(state.contacts, {
            chatId: chat._id,
            lastMessagePreview: chat.lastMessagePreview,
            lastMessageAt: chat.lastMessageAt,
            unreadCount: chat.unreadCount,
          });
        }
      })
      .addCase(fetchChatMessages.rejected, (state, action) => {
        state.messagesLoading = false;
        state.error = action.payload;
      })
      .addCase(markChatRead.fulfilled, (state, action) => {
        const { chatId, unreadCount } = action.payload;
        state.chats = state.chats.map((chat) =>
          chat._id === chatId ? { ...chat, unreadCount } : chat,
        );
        state.contacts = applyThreadToContacts(state.contacts, { chatId, unreadCount });
      })
      .addCase(sendChatMessage.pending, (state) => {
        state.sending = true;
      })
      .addCase(sendChatMessage.fulfilled, (state, action) => {
        state.sending = false;
        const { chatId, message, thread } = action.payload;
        const currentMessages = state.messagesByChat[chatId] || [];
        state.messagesByChat[chatId] = upsertMessage(currentMessages, message);
        state.chats = upsertChatSummary(state.chats, {
          _id: chatId,
          lastMessagePreview: thread?.lastMessagePreview || message.text || '',
          lastMessageSender: thread?.lastMessageSender || message.sender,
          lastMessageAt: thread?.lastMessageAt || message.createdAt || new Date().toISOString(),
          unreadCount: 0,
        });
        state.contacts = applyThreadToContacts(state.contacts, {
          chatId,
          lastMessagePreview: thread?.lastMessagePreview || message.text || '',
          lastMessageAt: thread?.lastMessageAt || message.createdAt || new Date().toISOString(),
          unreadCount: 0,
        });
      })
      .addCase(sendChatMessage.rejected, (state, action) => {
        state.sending = false;
        state.error = action.payload;
      });
  },
});

export const { setActiveChatId, appendIncomingMessage, applyThreadUpdate, clearChatState } =
  chatSlice.actions;
export default chatSlice.reducer;
