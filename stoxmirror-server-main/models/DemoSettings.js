const mongoose = require("mongoose");

// Singleton-style settings document for the "Demo" deposit method —
// same pattern as Settings.js / Wiretransfersettings.js. There's only
// ever one row (key: "global"). When enabled, the Fund Account page
// shows a "Demo" option that pops a SweetAlert with this title/message
// instead of submitting a real deposit.
const DemoSettingsSchema = new mongoose.Schema({
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
  title: { type: String, default: "Demo Mode 🎉" },
  message: {
    type: String,
    default:
      "This is a portfolio demo — no real money is moved. Thanks for checking out the project!",
  },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: { type: String, default: null }, // admin email, for audit trail
});

module.exports = mongoose.model("demosettings", DemoSettingsSchema);
