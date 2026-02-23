import { io } from 'socket.io-client';

let socket;
let currentSocketIdentity;

export const getSocket = (params = {}) => {
  const userId = typeof params === 'string' ? params : params.userId;
  const token =
    (typeof params === 'object' && params?.token) || localStorage.getItem('krishihub_token') || '';
  const safeUserId = userId || '';
  const identity = `${safeUserId}:${token}`;

  if (!socket || currentSocketIdentity !== identity) {
    if (socket) {
      socket.disconnect();
    }

    socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      autoConnect: true,
      auth: { userId: safeUserId, token },
      transports: ['websocket', 'polling'],
    });

    currentSocketIdentity = identity;
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentSocketIdentity = undefined;
  }
};
