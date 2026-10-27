var express = require("express");
const DemoSettings = require("../models/DemoSettings");
const { requireAdmin } = require("../middleware/auth");
var router = express.Router();

// Route file for the "Demo" deposit method's settings. Mirrors
// Wiretransfersettings.js: public GET for the Fund Account page, plus
// admin-only read / toggle / update / delete.

async function getOrSeedSettings() {
  let settings = await DemoSettings.findOne({ key: "global" });
  if (!settings) {
    settings = await DemoSettings.create({ key: "global" });
  }
  return settings;
}

// PUBLIC: the Fund Account page reads this to decide whether to show the
// Demo option and what message to pop up.
router.get("/", async function (req, res) {
  try {
    const settings = await getOrSeedSettings();
    res.status(200).json({
      code: "Ok",
      data: {
        enabled: settings.enabled,
        title: settings.title,
        message: settings.message,
      },
    });
  } catch (error) {
    console.error("Error fetching demo settings:", error);
    res.status(500).json({ message: "Failed to fetch demo settings" });
  }
});

// ADMIN: read full record incl. audit fields.
router.get("/admin", requireAdmin, async function (req, res) {
  try {
    const settings = await getOrSeedSettings();
    res.status(200).json({ code: "Ok", data: settings });
  } catch (error) {
    console.error("Error fetching demo settings (admin):", error);
    res.status(500).json({ message: "Failed to fetch demo settings" });
  }
});

// ADMIN: toggle on/off only, so the switch can fire one lightweight request.
router.put("/toggle", requireAdmin, async function (req, res) {
  const { enabled } = req.body;

  if (typeof enabled !== "boolean") {
    return res.status(400).json({ message: "enabled must be a boolean" });
  }

  try {
    const settings = await DemoSettings.findOneAndUpdate(
      { key: "global" },
      { $set: { enabled, updatedAt: new Date(), updatedBy: req.admin.email } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(
      `[demoSettings.toggle] set to ${enabled} by ${req.admin.email} (userId=${req.admin.userId}) at ${new Date().toISOString()}`
    );

    res.status(200).json({ code: "Ok", data: settings });
  } catch (error) {
    console.error("Error toggling demo settings:", error);
    res.status(500).json({ message: "Failed to toggle demo settings" });
  }
});

// ADMIN: create-or-update the message content.
router.put("/", requireAdmin, async function (req, res) {
  const { title, message } = req.body;

  if (typeof title !== "string" || typeof message !== "string") {
    return res.status(400).json({ message: "title and message must be strings" });
  }
  if (!message.trim()) {
    return res.status(400).json({ message: "message cannot be empty" });
  }
  if (title.length > 200 || message.length > 5000) {
    return res.status(400).json({ message: "title max 200 chars, message max 5000 chars" });
  }

  const fields = { title: title.trim(), message: message.trim() };

  try {
    const settings = await DemoSettings.findOneAndUpdate(
      { key: "global" },
      { $set: { ...fields, updatedAt: new Date(), updatedBy: req.admin.email } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(
      `[demoSettings.update] updated by ${req.admin.email} (userId=${req.admin.userId}) at ${new Date().toISOString()}:`,
      fields
    );

    res.status(200).json({ code: "Ok", data: settings });
  } catch (error) {
    console.error("Error updating demo settings:", error);
    res.status(500).json({ message: "Failed to update demo settings" });
  }
});

// ADMIN: delete the message content. The enabled flag is kept as-is; the
// Fund Account page falls back to a built-in message while it's empty.
router.delete("/", requireAdmin, async function (req, res) {
  try {
    const settings = await DemoSettings.findOneAndUpdate(
      { key: "global" },
      { $set: { title: "", message: "", updatedAt: new Date(), updatedBy: req.admin.email } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(
      `[demoSettings.delete] message cleared by ${req.admin.email} (userId=${req.admin.userId}) at ${new Date().toISOString()}`
    );

    res.status(200).json({ code: "Ok", data: settings });
  } catch (error) {
    console.error("Error deleting demo message:", error);
    res.status(500).json({ message: "Failed to delete demo message" });
  }
});

module.exports = router;
