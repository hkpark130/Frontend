import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { fetchNotifications, markNotificationAsRead, deleteNotification } from "@/api/notifications";
import './NotificationBell.css';

const REFRESH_INTERVAL = 60_000;

export default function NotificationBell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const username = auth.user?.profile?.preferred_username;

  useEffect(() => {
    if (!auth.isAuthenticated || !username) {
      setNotifications([]);
      return undefined;
    }

    let isMounted = true;

    const load = async () => {
      try {
        const data = await fetchNotifications(username);
        if (isMounted) {
          setNotifications(normalizeNotifications(data));
        }
      } catch (error) {
        console.error("Failed to load notifications", error);
      }
    };

    load();
    const timer = window.setInterval(load, REFRESH_INTERVAL);

    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [auth.isAuthenticated, username]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const items = useMemo(() => normalizeNotifications(notifications), [notifications]);

  const unreadCount = useMemo(
    () => items.filter((notification) => !notification.is_read).length,
    [items],
  );

  const handleToggle = () => {
    if (!auth.isAuthenticated) return;
    setIsOpen((prev) => !prev);
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.is_read) {
        await markNotificationAsRead(notification.id);
        setNotifications((prev) =>
          normalizeNotifications(prev).map((item) =>
            item.id === notification.id ? { ...item, is_read: true } : item,
          ),
        );
      }

      if (notification.link) {
        navigate(notification.link);
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const handleNotificationKeyDown = (event, notification) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleNotificationClick(notification);
    }
  };

  const handleDeleteNotification = async (event, notification) => {
    event.stopPropagation();
    if (!username) {
      alert("로그인 정보를 확인할 수 없습니다.");
      return;
    }
    try {
      await deleteNotification(notification.id, username);
      setNotifications((prev) =>
        normalizeNotifications(prev).filter((item) => item.id !== notification.id),
      );
    } catch (error) {
      console.error("Failed to delete notification", error);
      alert("알림 삭제 중 오류가 발생했습니다.");
    }
  };

  if (!auth.isAuthenticated) {
    return null;
  }

  return (
    <div className="notification-wrapper" ref={dropdownRef} style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
      <button type="button" className="notification-bell" onClick={handleToggle}>
        <BellIcon />
        {unreadCount > 0 && <span className="notification-dot" />}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-heading">
            <span>알림</span>
            {unreadCount > 0 && <span className="notification-unread">미확인 {unreadCount}건</span>}
          </div>
          <div className="notification-list">
            {items.length === 0 ? (
              <div className="notification-empty">표시할 알림이 없습니다.</div>
            ) : (
              items.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.is_read ? "read" : ""}`}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    className="notification-body"
                    onClick={() => handleNotificationClick(notification)}
                    onKeyDown={(event) => handleNotificationKeyDown(event, notification)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                  >
                    <span
                      className={`notification-icon ${notification.iconClass || ""}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: 40,
                        height: 40,
                        borderRadius: 6,
                        flex: '0 0 40px'
                      }}
                    >
                      {resolveIcon(notification.icon)}
                    </span>
                    <span className="notification-content" style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="notification-subject">{notification.subject}</span>
                      <span className="notification-meta">{notification.date}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="notification-remove"
                    aria-label="알림 삭제"
                    title="알림 삭제"
                    style={{ marginLeft: "auto", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={(event) => handleDeleteNotification(event, notification)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 21a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v4l-1.71 1.71A1 1 0 0 0 5.29 18h13.42a1 1 0 0 0 .71-1.71Z"
        fill="currentColor"
      />
    </svg>
  );
}

function resolveIcon(icon) {
  switch (icon) {
    case "inbox":
      return "IN";
    case "corner-down-left":
      return "RT";
    case "check-square":
      return "OK";
    case "trash":
      return "RM";
    case "dollar-sign":
      return "$";
    case "edit":
      return "ED";
    case "message-square":
      return "MSG";
    default:
      return "BL";
  }
}

function normalizeNotifications(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    if (Array.isArray(value.content)) {
      return value.content;
    }
    if (Array.isArray(value.items)) {
      return value.items;
    }
    if (Array.isArray(value.data)) {
      return value.data;
    }
    if (Array.isArray(value.results)) {
      return value.results;
    }
  }

  return [];
}
