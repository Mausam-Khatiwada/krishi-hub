import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppSelector } from '../app/hooks';
import { getSocket } from '../utils/socket';
import { MessageCircleIcon, ArrowRightIcon } from './icons/AppIcons';

const ChatToastListener = () => {
  const { user, token } = useAppSelector((state) => state.auth);
  const location = useLocation();
  const navigate = useNavigate();
  const shownMessageKeysRef = useRef(new Set());

  const isChatRoute = useMemo(() => location.pathname.startsWith('/chat'), [location.pathname]);

  useEffect(() => {
    if (!user?._id || !token) return undefined;

    const socket = getSocket({ userId: user._id, token });

    const onIncomingMessage = (payload) => {
      const incomingChatId = payload?.chatId;
      const message = payload?.message;
      const senderId = typeof message?.sender === 'object' ? message.sender?._id : message?.sender;

      if (!incomingChatId || senderId === user._id) return;

      const dedupeKey =
        message?._id || `${incomingChatId}:${senderId || 'unknown'}:${message?.createdAt || ''}:${message?.text || ''}`;
      if (shownMessageKeysRef.current.has(dedupeKey)) return;

      shownMessageKeysRef.current.add(dedupeKey);
      if (shownMessageKeysRef.current.size > 80) {
        const oldest = shownMessageKeysRef.current.values().next().value;
        if (oldest) shownMessageKeysRef.current.delete(oldest);
      }

      if (isChatRoute && !document.hidden) return;

      const senderName =
        typeof message?.sender === 'object'
          ? message.sender?.name || 'New message'
          : payload?.senderName || 'New message';
      const preview = message?.text || 'New message received';

      toast.custom(
        (t) => (
          <button
            type="button"
            className={`chat-toast ${t.visible ? 'show' : ''}`}
            onClick={() => {
              toast.dismiss(t.id);
              navigate(`/chat?chatId=${incomingChatId}`);
            }}
          >
            <span className="chat-toast-icon">
              <MessageCircleIcon className="h-4 w-4" />
            </span>
            <span className="chat-toast-copy">
              <span className="chat-toast-title">{senderName}</span>
              <span className="chat-toast-preview">{preview}</span>
            </span>
            <span className="chat-toast-action">
              Open
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </span>
          </button>
        ),
        { duration: 5000 },
      );
    };

    socket.on('chat:message', onIncomingMessage);

    return () => {
      socket.off('chat:message', onIncomingMessage);
    };
  }, [isChatRoute, navigate, token, user?._id]);

  useEffect(() => {
    if (!user?._id) {
      shownMessageKeysRef.current.clear();
    }
  }, [user?._id]);

  return null;
};

export default ChatToastListener;
