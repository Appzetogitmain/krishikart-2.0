import dotenv from "dotenv";
import mongoose from "mongoose";
import GlobalSetting from "../app/models/globalSetting.js";
import {
  LEGAL_CMS_KEYS,
  LEGAL_CMS_DESCRIPTIONS,
} from "../app/constants/legalCmsKeys.js";
import { LEGAL_CMS_DEFAULTS } from "../app/constants/legalCmsDefaults.js";

dotenv.config();

const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

async function upsertLegal(key, value) {
  await GlobalSetting.findOneAndUpdate(
    { key },
    { key, value, description: LEGAL_CMS_DESCRIPTIONS[key] },
    { upsert: true, new: true },
  );
}

async function main() {
  if (!uri) {
    console.error("MONGO_URI / MONGODB_URI not set");
    process.exit(1);
  }
  await mongoose.connect(uri);

  await upsertLegal(LEGAL_CMS_KEYS.privacy, LEGAL_CMS_DEFAULTS.privacy);
  await upsertLegal(LEGAL_CMS_KEYS.contact, LEGAL_CMS_DEFAULTS.contact);
  await upsertLegal(LEGAL_CMS_KEYS.terms, LEGAL_CMS_DEFAULTS.terms);

  console.log("Legal CMS defaults seeded (privacy, contact, terms).");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
