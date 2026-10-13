/** Capitalize first letter of string; trim. Used for product/category/subcategory names. */
export const capitalizeFirst = (val) => {
    if (val == null || typeof val !== 'string') return val;
    const s = String(val).trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
};

// Technical messages that reach users through app toasts -> plain language.
const FRIENDLY_MESSAGES = {
  "Token required": "Please log in to continue.",
  "Invalid token": "Your session has expired. Please log in again.",
  "Invalid or expired token": "Your session has expired. Please log in again.",
  "Unauthorized": "Your session has expired. Please log in again.",
  "Vendor identification missing": "Your session has expired. Please log in again.",
  "OTP expired": "This OTP has expired. Please request a new one.",
  "Invalid OTP": "The OTP you entered is incorrect. Please try again.",
  "OTP not found or expired": "This OTP has expired. Please request a new one.",
  "Invalid mobile number": "Please enter a valid 10-digit mobile number.",
  "Mobile & OTP are required": "Please enter your mobile number and OTP.",
  "Mobile & OTP required": "Please enter your mobile number and OTP.",
  "All fields required": "Please fill in all the required fields.",
  "Invalid payment signature": "We couldn't confirm your payment. If money was deducted, it will be refunded automatically. Please contact support.",
  "Account blocked": "Your account has been blocked. Please contact support.",
  "Invalid status choice": "This status change is not allowed.",
};

const friendlyMessage = (statusCode, message) => {
  if (statusCode === 500) {
    // Never show raw server/database errors (e.g. "Server error: Cast to ObjectId failed...")
    return "Something went wrong on our side. Please try again in a moment.";
  }
  if (typeof message !== "string") return message;
  if (FRIENDLY_MESSAGES[message]) return FRIENDLY_MESSAGES[message];
  const transition = message.match(/^Transition Error: Cannot move from (.+) to (.+)$/);
  if (transition) {
    return `This order is already "${transition[1]}", so it can't be changed to "${transition[2]}". Please refresh the page.`;
  }
  return message;
};

export const handleResponse = (res, statusCode, message, data = {}) => {
  const success = statusCode >= 200 && statusCode < 300;
  if (!success && statusCode === 500 && message) {
    console.error(`[API 500] ${res.req?.method || ""} ${res.req?.originalUrl || ""} -> ${message}`);
  }
  message = friendlyMessage(statusCode, message);

  const sanitize = (item) => {
    if (!item) return item;
    const obj = item.toObject?.() || item;
    const { password, __v, ...cleaned } = obj;
    return cleaned;
  };

  const sanitizedData = Array.isArray(data)
    ? data.map(sanitize)
    : sanitize(data);

  const responsePayload = {
    success,
    error: !success,
    message,
  };

  if (Array.isArray(sanitizedData)) {
    responsePayload.results = sanitizedData;
  } else {
    responsePayload.result = sanitizedData;
  }

  return res.status(statusCode).json(responsePayload);
};

export default handleResponse;