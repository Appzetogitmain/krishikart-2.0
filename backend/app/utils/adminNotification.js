import AdminNotification from "../models/adminNotification.js";
import { emitToAdmin } from "../lib/socket.js";
import { cityKeysFor } from "./adminCity.js";

const formatNotification = (notification, adminId = null) => ({
  id: notification._id.toString(),
  type: notification.type,
  title: notification.title,
  message: notification.message,
  link: notification.link || "",
  meta: notification.meta || {},
  cityKeys: notification.cityKeys || [],
  createdAt: notification.createdAt,
  read: adminId
    ? notification.readBy?.some(
        (readerId) => readerId?.toString() === adminId.toString(),
      ) || false
    : false,
});

export const createAdminNotification = async ({
  type = "general",
  title,
  message,
  link = "",
  meta = {},
}) => {
  if (!title || !message) return null;

  // Which city this belongs to, so only that city's admin (and head office) sees it
  const cityKeys = await cityKeysFor(meta);
  const notification = await AdminNotification.create({
    type,
    title,
    message,
    link,
    meta,
    cityKeys,
  });

  emitToAdmin("admin_notification", formatNotification(notification));
  return notification;
};

export const mapAdminNotificationForViewer = (notification, adminId) =>
  formatNotification(notification, adminId);
