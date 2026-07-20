/**
 * Seed a static (hashed) login OTP on a vendor document in MongoDB.
 * Usage: node scripts/seedVendorStaticOtp.js
 * Optional: MOBILE=9300024000 OTP=123456 EMAIL=shivam@gmail.com node scripts/seedVendorStaticOtp.js
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import Vendor from "../app/models/vendor.js";
import { hashOTP } from "../app/utils/otpHelper.js";

dotenv.config();

const MOBILE = (process.env.SEED_VENDOR_MOBILE || "9300024000").trim();
const EMAIL = (process.env.SEED_VENDOR_EMAIL || "shivam@gmail.com").trim().toLowerCase();
const PLAIN_OTP = (process.env.SEED_VENDOR_OTP || "123456").trim();

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(uri);

  let vendor = await Vendor.findOne({
    $or: [{ mobile: MOBILE }, { email: EMAIL }],
  }).select("+staticOtpHash");

  if (!vendor) {
    console.error(`Vendor not found for mobile=${MOBILE} or email=${EMAIL}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const staticOtpHash = await hashOTP(PLAIN_OTP);
  vendor.staticOtpHash = staticOtpHash;
  await vendor.save();

  console.log("Vendor static OTP seeded in DB:");
  console.log({
    id: String(vendor._id),
    email: vendor.email,
    mobile: vendor.mobile,
    otp: PLAIN_OTP,
    field: "staticOtpHash",
  });

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
