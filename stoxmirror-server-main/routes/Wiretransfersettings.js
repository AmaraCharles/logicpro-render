var express = require("express");
const WireTransferSettings = require("../models/Wiretransfersettings");
const { requireAdmin } = require("../middleware/auth");
var router = express.Router();

/* NEW CODE 009
   Route file for the demo Wire Transfer deposit method's settings.
   Structure deliberately mirrors settings.js (the existing crypto
   deposit-wallets route) so it fits the codebase's existing patterns:
     - a getOrSeed helper that creates the singleton row on first use
     - a public GET for what the Fund Account page needs to render
     - an admin-only PUT that requires a valid admin JWT (requireAdmin)
     - a small console audit log line on every admin write, same as
       settings.js already does for wallet changes
*/

async function getOrSeedSettings() {
  let settings = await WireTransferSettings.findOne({ key: "global" });
  if (!settings) {
    settings = await WireTransferSettings.create({ key: "global" });
    // schema defaults populate all the demo field values automatically
  }
  return settings;
}

// ---------------------------------------------------------------------
// PUBLIC: the Fund Account page reads this to decide whether to show
// the Wire Transfer option at all, and what demo details to display.
// Note this is intentionally public (no auth) — same trust level as
// GET /settings/wallets already is, since it's just UI copy, not a
// real financial credential.
// ---------------------------------------------------------------------
router.get("/", async function (req, res) {
  try {
    const settings = await getOrSeedSettings();
    res.status(200).json({
      code: "Ok",
      data: {
        enabled: settings.enabled,
        bankName: settings.bankName,
        bankAddress: settings.bankAddress,
        accountName: settings.accountName,
        accountNumber: settings.accountNumber,
        routingOrSortCode: settings.routingOrSortCode,
        swiftBic: settings.swiftBic,
        referenceNote: settings.referenceNote,
      },
    });
  } catch (error) {
    console.error("Error fetching wire transfer settings:", error);
    res.status(500).json({ message: "Failed to fetch wire transfer settings" });
  }
});

// ---------------------------------------------------------------------
// ADMIN: read full record (same as public GET today, but kept as a
// separate admin route in case audit fields like updatedBy get added
// to the public response later and need to stay admin-only).
// ---------------------------------------------------------------------
router.get("/admin", requireAdmin, async function (req, res) {
  try {
    const settings = await getOrSeedSettings();
    res.status(200).json({ code: "Ok", data: settings });
  } catch (error) {
    console.error("Error fetching wire transfer settings (admin):", error);
    res.status(500).json({ message: "Failed to fetch wire transfer settings" });
  }
});

// ---------------------------------------------------------------------
// ADMIN: toggle on/off only. Separate from the full update so the
// admin UI's toggle switch can fire a single lightweight request
// without resending every field.
// ---------------------------------------------------------------------
router.put("/toggle", requireAdmin, async function (req, res) {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "enabled must be a boolean" });
  }

  try {
    const settings = await WireTransferSettings.findOneAndUpdate(
      { key: "global" },
      { $set: { enabled, updatedAt: new Date(), updatedBy: req.admin.email } },
      { new: true, upsert: true }
    );

    console.log(
      `[wireTransferSettings.toggle] set to ${enabled} by ${req.admin.email} (userId=${req.admin.userId}) at ${new Date().toISOString()}`
    );

    res.status(200).json({ code: "Ok", data: settings });
  } catch (error) {
    console.error("Error toggling wire transfer settings:", error);
    res.status(500).json({ message: "Failed to toggle wire transfer settings" });
  }
});

// ---------------------------------------------------------------------
// ADMIN: full update (create-or-update the singleton's fields) —
// this is the "Update" in CRUD for the bank-detail fields.
// ---------------------------------------------------------------------
router.put("/", requireAdmin, async function (req, res) {
  const {
    bankName,
    bankAddress = "", // optional so older admin pages that don't send it still save
    accountName,
    accountNumber,
    routingOrSortCode,
    swiftBic,
    referenceNote,
  } = req.body;

  const fields = { bankName, bankAddress, accountName, accountNumber, routingOrSortCode, swiftBic, referenceNote };

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string") {
      return res.status(400).json({ message: `${key} must be a string` });
    }
  }

  try {
    const settings = await WireTransferSettings.findOneAndUpdate(
      { key: "global" },
      {
        $set: {
          ...fields,
          updatedAt: new Date(),
          updatedBy: req.admin.email,
        },
      },
      { new: true, upsert: true }
    );

    console.log(
      `[wireTransferSettings.update] updated by ${req.admin.email} (userId=${req.admin.userId}) at ${new Date().toISOString()}:`,
      fields
    );

    res.status(200).json({ code: "Ok", data: settings });
  } catch (error) {
    console.error("Error updating wire transfer settings:", error);
    res.status(500).json({ message: "Failed to update wire transfer settings" });
  }
});

// ---------------------------------------------------------------------
// ADMIN: "Delete" — since this is a singleton settings document (same
// shape as Settings.js), delete == reset to the schema's demo defaults
// rather than removing the row entirely, matching the admin UI's
// "Reset to Demo Defaults" button.
// ---------------------------------------------------------------------
router.delete("/", requireAdmin, async function (req, res) {
  try {
    await WireTransferSettings.deleteOne({ key: "global" });
    const fresh = await getOrSeedSettings(); // recreates with schema defaults

    console.log(
      `[wireTransferSettings.reset] reset to defaults by ${req.admin.email} (userId=${req.admin.userId}) at ${new Date().toISOString()}`
    );

    res.status(200).json({ code: "Ok", data: fresh });
  } catch (error) {
    console.error("Error resetting wire transfer settings:", error);
    res.status(500).json({ message: "Failed to reset wire transfer settings" });
  }
});

module.exports = router;