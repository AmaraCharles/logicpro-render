const mongoose = require("mongoose");

/* NEW CODE 008
   Singleton-style settings document for the demo Wire Transfer deposit
   method — mirrors the existing Settings.js pattern used for crypto
   deposit wallets. There's only ever one row (key: "global").

   Every field here is meant to hold obviously-fake demo data (see the
   defaults in wireTransferSettings.js route file). Nothing in this
   model represents, or is intended to ever represent, a real bank
   account. */
const WireTransferSettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: "global",
  },
  enabled: {
    type: Boolean,
    default: false, // off until an admin explicitly turns it on
  },
  bankName: { type: String, default: "DEMO BANK" },
  bankAddress: { type: String, default: "" },
  accountName: { type: String, default: "DEMO ACCOUNT — PORTFOLIO PROJECT" },
  accountNumber: { type: String, default: "0000 0000 0000 0000" },
  routingOrSortCode: { type: String, default: "000000" },
  swiftBic: { type: String, default: "DEMOXX00" },
  referenceNote: {
    type: String,
    default: "Use your email/fullname as payment reference",
  },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: null }, // admin email, for audit trail
});

module.exports = mongoose.model("wiretransfersettings", WireTransferSettingsSchema);