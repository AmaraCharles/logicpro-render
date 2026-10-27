const mongoose = require("mongoose");

// Append-only trail of every change to the deposit wallets, including
// rejected attempts (bad password, version conflict), so any change to
// where users' deposits go can be traced to an admin, IP and time.
const WalletAuditLogSchema = new mongoose.Schema({
  at: { type: Date, default: Date.now, index: true },
  action: { type: String, required: true }, // "update" | "denied"
  reason: { type: String, default: "" },
  adminId: { type: String, default: "" },
  adminEmail: { type: String, default: "" },
  ip: { type: String, default: "" },
  userAgent: { type: String, default: "" },
  fromVersion: { type: Number },
  toVersion: { type: Number },
  before: { type: Array, default: undefined },
  after: { type: Array, default: undefined },
});

module.exports = mongoose.model("walletauditlog", WalletAuditLogSchema);
