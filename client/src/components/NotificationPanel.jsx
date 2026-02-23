import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../features/notifications/notificationSlice';
import { formatDate } from '../utils/format';
import { BellIcon, ClockIcon, SparkleIcon } from './icons/AppIcons';

const NotificationPanel = () => {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const { notifications } = useAppSelector((state) => state.notifications);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.isRead).length,
    [notifications],
  );

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((prev) => !prev)} className="btn-ghost relative">
        <BellIcon className="h-4 w-4" />
        Alerts
        {!!unreadCount && (
          <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[22rem] rounded-2xl border border-[var(--line)] bg-[var(--surface)]/96 p-3 shadow-2xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <SparkleIcon className="h-4 w-4 text-[var(--accent)]" />
              Notifications
            </p>
            <button type="button" onClick={() => dispatch(markAllNotificationsRead())} className="btn-ghost !px-2 !py-1 text-[11px]">
              Mark all read
            </button>
          </div>

          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {notifications.slice(0, 15).map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => dispatch(markNotificationRead(item._id))}
                className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                  item.isRead
                    ? 'border-[var(--line)] text-[var(--text-muted)]'
                    : 'border-[var(--accent)] bg-[var(--bg-soft)] text-[var(--text)]'
                }`}
              >
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 line-clamp-2">{item.message}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                  <ClockIcon className="h-3 w-3" />
                  {formatDate(item.createdAt)}
                </p>
              </button>
            ))}

            {!notifications.length && (
              <p className="rounded-xl border border-dashed border-[var(--line)] px-3 py-4 text-center text-xs text-[var(--text-muted)]">
                No notifications yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
