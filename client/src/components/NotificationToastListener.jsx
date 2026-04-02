import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchNotifications } from '../features/notifications/notificationSlice';
import { ArrowRightIcon, BellIcon } from './icons/AppIcons';
import { OPEN_NOTIFICATIONS_EVENT } from '../constants/events';

const NotificationToastListener = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const { notifications } = useAppSelector((state) => state.notifications);
  const readyRef = useRef(false);
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    if (!user?._id) return undefined;

    dispatch(fetchNotifications());

    const interval = setInterval(() => {
      if (document.hidden) return;
      dispatch(fetchNotifications());
    }, 45000);

    return () => clearInterval(interval);
  }, [dispatch, user?._id]);

  useEffect(() => {
    if (!user?._id) return;

    const nextIds = new Set(notifications.map((item) => item._id));

    if (!readyRef.current) {
      knownIdsRef.current = nextIds;
      readyRef.current = true;
      return;
    }

    const newItems = notifications.filter(
      (item) => !knownIdsRef.current.has(item._id) && !item.isRead,
    );

    if (newItems.length && !document.hidden) {
      newItems.slice(0, 2).forEach((item) => {
        toast.custom(
          (t) => (
            <button
              type="button"
              className={`alert-toast ${t.visible ? 'show' : ''}`}
              onClick={() => {
                toast.dismiss(t.id);
                window.dispatchEvent(new Event(OPEN_NOTIFICATIONS_EVENT));
              }}
            >
              <span className="alert-toast-icon">
                <BellIcon className="h-4 w-4" />
              </span>
              <span className="alert-toast-copy">
                <span className="alert-toast-title">{item.title || 'New alert'}</span>
                <span className="alert-toast-preview">{item.message || 'Tap to view details'}</span>
              </span>
              <span className="alert-toast-action">
                View
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </span>
            </button>
          ),
          {
            id: `notification:${item._id}`,
            duration: 5500,
          },
        );
      });
    }

    knownIdsRef.current = nextIds;
  }, [notifications, user?._id]);

  useEffect(() => {
    if (user?._id) return;
    readyRef.current = false;
    knownIdsRef.current.clear();
  }, [user?._id]);

  return null;
};

export default NotificationToastListener;
