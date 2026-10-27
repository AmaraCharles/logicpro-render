var express = require("express");
const UsersDatabase = require("../models/User");
const { hashPassword } = require("../utils");
const { v4: uuidv4 } = require("uuid");
const { requireAdmin } = require("../middleware/auth");
var router = express.Router();

router.get("/", requireAdmin, async function (req, res, next) {
  const users = await UsersDatabase.find().select("-password");

  res.status(200).json({ code: "Ok", data: users });
});

/* GET users listing. */
router.get("/:email", async function (req, res, next) {
  const { email } = req.params;

  const user = await UsersDatabase.findOne({ email: email });

  if (!user) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  res.status(200).json({ code: "Ok", data: user });
});
router.delete("/:email/delete", async function (req, res, next) {
  const { email } = req.params;

  const user = await UsersDatabase.findOne({ email: email });

  if (!user) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  user.deleteOne();

  res.status(200).json({ code: "Ok" });
});

router.put("/:_id/profile/update", async function (req, res, next) {
  const { _id } = req.params;

  const user = await UsersDatabase.findOne({ _id: _id });

  if (!user) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  try {
    await user.update({
      ...req.body,
    });

    return res.status(200).json({
      message: "update was successful",
    });
  } catch (error) {
    console.log(error);
  }
});

// Dedicated wallet credit/debit endpoint.
// Unlike /:_id/profile/update (which blindly overwrites whatever fields the
// caller sends), this computes the new value atomically with $inc and keeps
// a running audit trail in walletAdjustments, so two admins acting at the
// same time can't clobber each other's change and every change has a record.
router.put("/:_id/wallet/adjust", requireAdmin, async function (req, res) {
  const { _id } = req.params;
  const { field, type, amount, reason } = req.body;

  if (!["balance", "profit"].includes(field)) {
    return res.status(400).json({ message: "field must be 'balance' or 'profit'" });
  }
  if (!["credit", "debit"].includes(type)) {
    return res.status(400).json({ message: "type must be 'credit' or 'debit'" });
  }
  const amt = Number(amount);
  if (!amt || amt <= 0 || Number.isNaN(amt)) {
    return res.status(400).json({ message: "amount must be a positive number" });
  }

  const user = await UsersDatabase.findById(_id);
  if (!user) {
    return res.status(404).json({ message: "user not found" });
  }

  const delta = type === "credit" ? amt : -amt;
  const previousValue = Number(user[field] || 0);

  const entry = {
    _id: uuidv4(),
    field,
    type,
    amount: amt,
    reason: reason || null,
    admin: req.admin.email,
    previousValue,
    newValue: previousValue + delta,
    timestamp: new Date().toISOString(),
  };

  try {
    const updated = await UsersDatabase.findByIdAndUpdate(
      _id,
      {
        $inc: { [field]: delta },
        $push: { walletAdjustments: entry },
      },
      { new: true }
    );

    return res.status(200).json({
      code: "Ok",
      message: "Wallet adjusted successfully",
      data: { [field]: updated[field], adjustment: entry },
    });
  } catch (error) {
    console.error("Wallet adjustment error:", error);
    return res.status(500).json({ message: "Failed to adjust wallet" });
  }
});

router.put("/:_id/accounts/update", async function (req, res, next) {
  const { _id } = req.params;
  const accountDict = req.body;
  const data = accountDict.values;

  const user = await UsersDatabase.findOne({ _id: _id });

  if (!user) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  const cummulative = Object.assign({}, user.accounts, JSON.parse(data));

  console.log(cummulative);

  try {
    await user.updateOne({
      accounts: {
        ...cummulative,
      },
    });

    return res.status(200).json({
      message: "Account was updated successfully",
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/:_id/accounts", async function (req, res, next) {
  const { _id } = req.params;

  const user = await UsersDatabase.findOne({ _id: _id });

  if (!user) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  return res.status(200).json({
    data: user.accounts,
    message: "update was successful",
  });
});

module.exports = router;
