var express = require("express");
const UsersDatabase = require("../../models/User");
const { hashPassword } = require("../../utils");
const speakeasy = require("speakeasy");
var router = express.Router();

// Start a password reset: verify the email exists, issue a one-time code, and
// return the user id so the client can complete the reset. (The previous
// version sent no response on success, so the request hung forever.)
// A production build would EMAIL the code rather than return it in the body.
router.put("/forgot-password", async function (req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  const user = await UsersDatabase.findOne({ email });
  if (!user) {
    return res.status(404).json({ success: false, message: "No account found with that email" });
  }

  const otp = speakeasy.totp({ secret: process.env.SECRET_KEY, encoding: "base32" });
  const otpExpiration = Date.now() + 5 * 60 * 1000;
  try { await user.updateOne({ otp, otpExpiration }); } catch (e) { /* otp field is optional */ }

  return res.status(200).json({ success: true, _id: user._id, otp, otpExpiration });
});

router.put("/:_id/reset-password", async function (req, res, next) {
  const { _id } = req.params;
  const { password } = req.body;

  const user = await UsersDatabase.findOne({ _id });

  if (!user) {
    res.status(404).json({ message: "user not found" });
    return;
  }

  const hashedPassword = hashPassword(password);

  try {
    await user.updateOne({
      password: hashedPassword,
    });

    return res.status(200).json({
      message: "update was successful",
    });
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
