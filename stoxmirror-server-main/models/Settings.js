const mongoose = require("mongoose");

const DepositWalletSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // stable id sent back as the deposit "method"
    label: { type: String, required: true },
    network: { type: String, required: true },
    address: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

// Singleton-style settings document. There's only ever one row here
// (key: "global"), holding site-wide config.
const SettingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: "global",
  },
  // Legacy field from when the addresses were seeded from code. No longer
  // read — only wallets an admin saves into `cryptoWallets` are served.
  depositWallets: {
    type: Object,
    default: undefined,
  },
  cryptoWallets: { type: [DepositWalletSchema], default: [] },
  // Staking plan catalog, editable by an admin (see settings routes).
  // Stored loosely so plan fields can evolve without a migration.
  plans: { type: Array, default: undefined },
  // Investment plan catalog — a separate product from `plans` (staking).
  investmentPlans: { type: Array, default: undefined },
  // HMAC over cryptoWallets + walletsVersion, keyed by a server-side secret.
  // If someone edits the DB directly (leaked connection string, etc.) the
  // signature won't match and the public endpoint refuses to serve them.
  walletsSignature: { type: String, default: "" },
  walletsVersion: { type: Number, default: 0 },
  walletsUpdatedAt: { type: Date },
  walletsUpdatedBy: { type: String, default: "" },
});

module.exports = mongoose.model("settings", SettingsSchema);
