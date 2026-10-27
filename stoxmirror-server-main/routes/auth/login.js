var express = require("express");
var { compareHashedPassword } = require("../../utils");
const UsersDatabase = require("../../models/User");
const { signAdminToken, requireAdmin } = require("../../middleware/auth");
var router = express.Router();

function isAdminUser(user) {
  return user.isAdmin === true;
}

router.post("/login", async function (request, response) {
  const { email, password } = request.body;
  /**
   * step1: check if a user exists with that email
   * step2: check if the password to the email is correct
   * step3: if it is correct, return some data
   */

  // step1
  const user = await UsersDatabase.findOne({ email: email });

  if (user) {
    // step2
    const passwordIsCorrect = compareHashedPassword(user.password, password);

    if (passwordIsCorrect) {
      const responseBody = { code: "Ok", data: user };
      if (isAdminUser(user)) {
        // Only admin accounts get a token — this is what the admin
        // dashboard sends back as Authorization: Bearer <token> to prove
        // it's really talking to an authenticated admin.
        responseBody.token = signAdminToken(user);
      }
      response.status(200).json(responseBody);
    } else {
      response.status(502).json({ code: "invalid credentials" });
    }
  } else {
    response.status(404).json({ code: "no user found" });
  }
});


router.put("/login/:_id/enable", requireAdmin, async (req, res) => {
  const { _id } = req.params; // Use req.params to get the _id from the URL
  try {
    const user = await UsersDatabase.findOne({ _id });

    if (!user) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "User not found",
      });
    }

    // Update the user's "condition" property to "enabled"
    user.condition = "enabled";

    // Save the updated user
    await user.save();

    res.status(200).json({
      success: true,
      status: 200,
      message: "User enabled successfully",
      user: user, // You can omit this line if you don't want to send the updated user back in the response
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Internal Server Error",
    });
  }
});


router.put("/login/:_id/disable", requireAdmin, async (req, res) => {
  const { _id } = req.params; // Use req.params to get the _id from the URL
  try {
    const user = await UsersDatabase.findOne({ _id });

    if (!user) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "User not found",
      });
    }

    // Update the user's "condition" property to "enabled"
    user.condition = "disabled";

    // Save the updated user
    await user.save();

    res.status(200).json({
      success: true,
      status: 200,
      message: "User disabled successfully",
      user: user, // You can omit this line if you don't want to send the updated user back in the response
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      status: 500,
      message: "Internal Server Error",
    });
  }
});



router.post("/loginadmin", async function (request, response) {
  const { email} = request.body;
  /**
   * step1: check if a user exists with that email
   * step2: check if the password to the email is correct
   * step3: if it is correct, return some data
   */

  // step1
  const user = await UsersDatabase.findOne({ email: email });

  if (user) {
    // step2
   
      response.status(200).json({ code: "Ok", data: user });
   
}});



module.exports = router;
