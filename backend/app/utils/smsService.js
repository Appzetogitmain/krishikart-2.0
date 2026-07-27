import axios from "axios";
import fs from "fs";
import path from "path";

/**
 * SMS India HUB Configuration
 */
const API_URL = "http://cloud.smsindiahub.in/vendorsms/pushsms.aspx";
const API_TIMEOUT = 30000;

/**
 * Normalize mobile number to include country code (91)
 */
function normalizeMobileNumber(mobile) {
  let cleanMobile = String(mobile || "")
    .replace(/^\+/, "")
    .replace(/\D/g, "");
  if (!cleanMobile.startsWith("91")) {
    cleanMobile = "91" + cleanMobile;
  }
  return cleanMobile;
}

/**
 * Build DLT-compliant message.
 * Must match approved template EXACTLY (spaces/punctuation):
 * "Welcome to the ##var## powered by Appzeto.Your OTP for registration is ##var##.BGADEC"
 */
function buildOtpMessage(otp) {
  const appName = (process.env.APP_NAME || "kisaankart").trim();
  return `Welcome to the ${appName} powered by Appzeto.Your OTP for registration is ${otp}.BGADEC`;
}

/**
 * Parse SMS India Hub response (object JSON or plain "Failed#..." string).
 */
function parseSmsResponse(resData) {
  if (typeof resData === "string") {
    const text = resData.trim();
    const failed = /^Failed#/i.test(text) || /not valid/i.test(text);
    return {
      isSuccess: false,
      errorCode: failed ? "FAILED" : "",
      errorMsg: text,
      raw: text,
    };
  }

  const errorCode = String(resData?.ErrorCode ?? "");
  const errorMsg = String(resData?.ErrorMessage ?? "");
  const isSuccess =
    errorCode === "000" ||
    errorMsg === "Done" ||
    Boolean(resData?.JobId) ||
    Boolean(resData?.MessageData);

  return {
    isSuccess,
    errorCode,
    errorMsg,
    raw: resData,
  };
}

/**
 * Send SMS using SMS India API / Hub
 */
export const sendSMS = async (mobile, otp) => {
  const logFile = path.resolve("sms_debug.log");

  try {
    const apiKey = process.env.SMS_INDIA_HUB_API_KEY;
    const senderId = process.env.SMS_INDIA_HUB_SENDER_ID;
    const templateId = process.env.SMS_INDIA_HUB_DLT_TEMPLATE_ID;

    if (!apiKey || !senderId) {
      console.error("SMS India HUB credentials missing in .env");
      return false;
    }

    const cleanMobile = normalizeMobileNumber(mobile);
    const message = buildOtpMessage(otp);

    const params = {
      APIKey: apiKey.trim(),
      msisdn: cleanMobile,
      sid: senderId.trim(),
      msg: message,
      fl: "0",
      gwid: "2",
    };

    if (templateId && templateId.trim()) {
      params.DLT_TE_ID = templateId.trim();
    }

    const response = await axios.get(API_URL, {
      params,
      timeout: API_TIMEOUT,
      paramsSerializer: (p) =>
        Object.keys(p)
          .map(
            (key) =>
              `${encodeURIComponent(key)}=${encodeURIComponent(p[key])}`,
          )
          .join("&"),
    });

    const { isSuccess, errorCode, errorMsg, raw } = parseSmsResponse(
      response.data,
    );

    const logEntry = `[${new Date().toISOString()}] Mobile: ${mobile}, Success: ${isSuccess}, Response: ${JSON.stringify(raw)}, Msg: ${message}\n`;
    fs.appendFileSync(logFile, logEntry);

    if (isSuccess) {
      console.log("✅ SMS Sent successfully");
      return true;
    }

    console.error(`❌ SMS India HUB Error (Code: ${errorCode}): ${errorMsg}`);
    // Do NOT treat local/dev as success — otherwise UI shows "OTP sent" while SMS failed.
    return false;
  } catch (error) {
    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString()}] CRITICAL: ${error.message}\n`,
    );
    console.error("❌ SMS send critical error:", error.message);
    return false;
  }
};
