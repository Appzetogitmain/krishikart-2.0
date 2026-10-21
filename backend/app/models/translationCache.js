import mongoose from "mongoose";

// Text translated once through google-translate-api-x, kept so the same phrase is never fetched again
const translationCacheSchema = new mongoose.Schema(
  {
    lang: { type: String, required: true },
    text: { type: String, required: true },
    translated: { type: String, required: true },
  },
  { timestamps: true }
);

translationCacheSchema.index({ lang: 1, text: 1 }, { unique: true });

export default mongoose.model("TranslationCache", translationCacheSchema);
