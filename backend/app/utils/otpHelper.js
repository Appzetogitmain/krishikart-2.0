import bcrypt from "bcryptjs";

/**
 * Generate a 6-digit numeric OTP
 * @returns {string}
 */
export const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash the OTP using bcrypt
 * @param {string} otp 
 * @returns {Promise<string>}
 */
export const hashOTP = async (otp) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(otp, salt);
};

/**
 * Compare plain OTP with hashed OTP
 * @param {string} otp 
 * @param {string} hashedOtp 
 * @returns {Promise<boolean>}
 */
export const verifyHashedOTP = async (otp, hashedOtp) => {
    return await bcrypt.compare(otp, hashedOtp);
};

/**
 * When USE_DEFALT_OTP or USE_DEFAULT_OTP is "true" and DEFAULT_OTP is set,
 * that OTP is accepted for any valid mobile (all roles) — for staging/dev only.
 */
export function isGlobalDefaultOtpEnabled() {
    const v = (process.env.USE_DEFALT_OTP || process.env.USE_DEFAULT_OTP || "").toLowerCase().trim();
    return v === "true" || v === "1" || v === "yes";
}

/** Returns true if global default OTP mode is on and the submitted OTP matches DEFAULT_OTP. */
export function matchesGlobalDefaultOtp(otp) {
    if (!isGlobalDefaultOtpEnabled()) return false;
    const expected = (process.env.DEFAULT_OTP || "").trim();
    if (!expected) return false;
    return String(otp ?? "").trim() === expected;
}

/**
 * Checks an OTP against its stored record with a limit of 5 wrong attempts per code.
 * The attempt counter is increased atomically before comparing, so parallel guesses
 * can't get around the limit. After 5 wrong tries the code is deleted and the person
 * must request a new OTP.
 */
export const MAX_OTP_ATTEMPTS = 5;
export const verifyOtpRecord = async (otpRecord, otp) => {
    const { default: OTP } = await import("../models/otp.js");
    const claimed = await OTP.findOneAndUpdate(
        { _id: otpRecord._id, attempts: { $lt: MAX_OTP_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { returnDocument: "after" },
    );
    if (!claimed) {
        await OTP.deleteOne({ _id: otpRecord._id });
        return false;
    }
    const ok = await verifyHashedOTP(String(otp), claimed.otp);
    if (!ok && claimed.attempts >= MAX_OTP_ATTEMPTS) {
        await OTP.deleteOne({ _id: otpRecord._id });
    }
    return ok;
};
