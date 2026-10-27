var express = require("express");
var speakeasy=require("speakeasy")
var { hashPassword,sendPasswordOtp,userRegisteration, sendWelcomeEmail,resendWelcomeEmail,resetEmail, sendUserDetails, userRegisteration } = require("../../utils");
const UsersDatabase = require("../../models/User");
var router = express.Router();
const { v4: uuidv4 } = require("uuid");

// Function to generate a referral code
function generateReferralCode(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters.charAt(randomIndex);
  }

  return code;
}


// Registration questionnaire fields (currency page + trading/financial
// profile pages in register.html). Stored as-is on the user document.
const SURVEY_FIELDS = [
  "survey_yearsOfExperience",
  "survey_knowledgeLevel",
  "survey_tradingFrequency",
  "survey_preferredMarkets",
  "survey_instrumentsTraded",
  "survey_tradingPlatforms",
  "survey_annualIncome",
  "survey_primaryIncomeSource",
  "survey_taxResidency",
];

function cleanString(value) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

router.post("/register", async (req, res) => {
  const { firstName, lastName, email, password, country, referralCode, phone } = req.body;

  const currency = cleanString(req.body.currency);
  // Account type chosen at registration; defaults to individual if absent/invalid.
  const accountType = ["individual", "business"].includes(req.body.accountType)
    ? req.body.accountType
    : "individual";
  const survey = {};
  for (const field of SURVEY_FIELDS) {
    survey[field] = cleanString(req.body[field]);
  }
  // Computed here rather than trusted from the client's surveyCompleted flag
  const surveyCompleted = SURVEY_FIELDS.every((field) => survey[field]);

  // Every registration field is required except referralCode
  const required = {
    firstName: cleanString(firstName),
    lastName: cleanString(lastName),
    email: cleanString(email),
    password: typeof password === "string" ? password : "",
    country: cleanString(country),
    phone: cleanString(phone),
    currency,
    ...survey,
  };
  const missing = Object.keys(required).filter((field) => !required[field]);
  if (missing.length) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(", ")}`,
    });
  }

  // Generate OTP
  const otp = speakeasy.totp({
    secret: process.env.SECRET_KEY,
    encoding: "base32",
  });

  const otpExpiration = Date.now() + 5 * 60 * 1000; // 5 minutes

  try {
    // Check for existing user
    const existingUser = await UsersDatabase.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email address is already taken",
      });
    }

    // Optional: Find referrer
    let referrer = null;
    if (referralCode) {
      referrer = await UsersDatabase.findOne({ referralCode });
      if (!referrer) {
        return res.status(400).json({
          success: false,
          message: "Invalid referral code",
        });
      }
    }

    // Build new user object
    const newUser = new UsersDatabase({
      firstName,
      lastName,
      email,
      password: hashPassword(password),
      country,
      phone,
      currency,
      ...survey,
      surveyCompleted,
      accountType,
      termsAcceptedAt: new Date(), // register.html blocks signup until terms are accepted
      trader: "",
      amountDeposited:
        "You are not eligible to view livestream of ongoing trade. Kindly contact your trader or support.",
      profit: 0,
      balance: 0,
      copytrading: 0,
      plan: [],
      kyc: "unverified",
      condition: "",
      referalBonus: 0,
      transactions: [],
      withdrawals: [],
      planHistory: [],
      accounts: {
        eth: { address: "" },
        ltc: { address: "" },
        btc: { address: "" },
        usdt: { address: "" },
      },
      verified: false,
      isDisabled: false,
      referredUsers: [],
      copyTradingActive: [],
      otp,
      otpExpiration,
      rewards: [
        {
          id: "welcome",
          title: "Welcome Bonus",
          description: "Sign up and verify your account",
          amount: 25.0,
          claimed: false,
        },
        {
          id: "first-deposit",
          title: "First Deposit",
          description: "Make your first deposit of $100+",
          amount: 50.0,
          claimed: false,
        },
        {
          id: "first-trade",
          title: "First Trade",
          description: "Execute your first trade",
          amount: 10.0,
          claimed: false,
        },
        {
          id: "weekly-trader",
          title: "Weekly Trader",
          description: "Complete 10 trades this week",
          amount: 100.0,
          claimed: false,
        },
        {
          id: "copy-trading",
          title: "Copy Trading Master",
          description: "Follow 3 master traders",
          amount: 75.0,
          claimed: false,
        },
      ],
      referralCode: generateReferralCode(6),
      referredBy: referrer ? referrer._id : null,
    });

    // Save the new user
    const savedUser = await newUser.save();

    // If referred by someone, update referrer
    if (referrer) {
      referrer.referredUsers.push({
        dateJoined: new Date(),
        newUser: savedUser._id,
        name: `${savedUser.firstName} ${savedUser.lastName}`,
        status: "active",
        earned: 0,
      });
      await referrer.save();
    }

    // Send welcome email (with OTP)
    await sendWelcomeEmail({ to: email, otp });
    await userRegisteration({ firstName, email });

    return res.status(200).json({
      success: true,
      message: "User registered successfully",
      data: savedUser,
      otp,
      otpExpiration,
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});


// router.post("/register", async (req, res) => {
//   const { firstName, lastName, email, password, country, referralCode } = req.body;

//   try {
//     // Check if any user has that email
//     const user = await UsersDatabase.findOne({ email });

//     if (user) {
//       return res.status(400).json({
//         success: false,
//         message: "Email address is already taken",
//       });
//     }

//     // Find the referrer based on the provided referral code
//     let referrer = null;
//     if (referralCode) {
//       referrer = await UsersDatabase.findOne({ referralCode });
//       if (!referrer) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid referral code",
//         });
//       }
//     }

//     // Create a new user with referral information
//     const newUser = {
//       firstName,
//       lastName,
//       email,
//       password: hashPassword(password),
//       country,
//       amountDeposited: 0,
//       profit: 0,
//       balance: 0,
//       referalBonus: 0,
//       transactions: [],
//       withdrawals: [],
//       accounts: {
//         eth: {
//           address: "",
//         },
//         ltc: {
//           address: "",
//         },
//         btc: {
//           address: "",
//         },
//         usdt: {
//           address: "",
//         },
//       },
//       verified: false,
//       isDisabled: false,
//     };

//     // Generate a referral code for the new user only if referralCode is provided
//     if (referralCode) {
//       newUser.referralCode = generateReferralCode(6);
//     }

//     // If there's a referrer, update their referredUsers list
//     if (referrer) {
//       newUser.referredBy = referrer._id;
//       referrer.referredUsers.push(newUser._id);
//       await referrer.save();
//     }

//     // Create the new user in the database
//     const createdUser = await UsersDatabase.create(newUser);
//     const token = uuidv4();
//     sendWelcomeEmail({ to: email, token });

//     return res.status(200).json({ code: "Ok", data: createdUser });
//   } catch (error) {
//     console.error("Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// });


// router.post("/register", async (req, res) => {
//   const { firstName, lastName, email, password, country } = req.body;

//   //   check if any user has that username
//   const user = await UsersDatabase.findOne({ email });

//   // if user exists
//   if (user) {
//     res.status(400).json({
//       success: false,
//       message: "email address is already taken",
//     });
//     return;
//   }

//   await UsersDatabase.create({
//     firstName,
//     lastName,
//     email,
//     password: hashPassword(password),
//     country,
//     amountDeposited: 0,
//     profit: 0,
//     balance: 0,
//     referalBonus: 0,
//     transactions: [],
//     withdrawals: [],
//     accounts: {
//       eth: {
//         address: "",
//       },
//       ltc: {
//         address: "",
//       },
//       btc: {
//         address: "",
//       },
//       usdt: {
//         address: "",
//       },
//     },
//     verified: false,
//     isDisabled: false,
//   })
//     .then((data) => {
//       return res.json({ code: "Ok", data: user });
//     })
//     .then(() => {
//       var token = uuidv4();
//       sendWelcomeEmail({ to: req.body.email, token });
//     })
//     .catch((error) => {
//       res.status(400).json({
//         success: false,
//         message: error.message,
//       });
//     });
// });



// Used by the forgot-password flow — sends the password reset OTP email
router.post("/register/resend", async (req, res) => {
  const { email } = req.body;
  const user = await UsersDatabase.findOne({ email });

  if (!user) {
    res.status(404).json({
      success: false,
      status: 404,
      message: "User not found",
    });

    return;
  }

  try {

    res.status(200).json({
      success: true,
      status: 200,
      message: "OTP resent successfully",
    });

 sendPasswordOtp({to:req.body.email})

  } catch (error) {
    console.log(error);
  }
});

// Used by the registration page — resends the account verification OTP
router.post("/register/resend-verification", async (req, res) => {
  const { email } = req.body;
  const user = await UsersDatabase.findOne({ email });

  if (!user) {
    res.status(404).json({
      success: false,
      status: 404,
      message: "User not found",
    });

    return;
  }

  try {
    // Issue a fresh OTP, same as /register
    const otp = speakeasy.totp({
      secret: process.env.SECRET_KEY,
      encoding: "base32",
    });
    const otpExpiration = Date.now() + 5 * 60 * 1000; // 5 minutes

    await user.updateOne({ otp, otpExpiration });
    await sendWelcomeEmail({ to: email, otp });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "OTP resent successfully",
      otp,
      otpExpiration,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
    });
  }
});


router.post("/register/reset", async (req, res) => {
  const { email } = req.body;
  const user = await UsersDatabase.findOne({ email });

  if (!user) {
    res.status(404).json({
      success: false,
      status: 404,
      message: "User not found",
    });

    return;
  }

  try {
    
    res.status(200).json({
      success: true,
      status: 200,
      message: "OTP resent successfully",
    });

    resetEmail({
      to:req.body.email
    });


   

  } catch (error) {
    console.log(error);
  }
});

router.post("/register/otp", async (req, res) => {
  const { email } = req.body;
  const { password }=req.body;
  const {firstName }=req.body;
  const user = await UsersDatabase.findOne({ email });

  if (!user) {
    res.status(404).json({
      success: false,
      status: 404,
      message: "User not found",
    });

    return;
  }

  try {
    
    res.status(200).json({
      success: true,
      status: 200,
      message: "OTP correct ",
    });

    sendUserDetails({
      to:req.body.email,
      password:req.body.password,
      firstName:req.body.firstName
    });


   

  } catch (error) {
    console.log(error);
  }
});




// const express = require("express");
// const { hashPassword, sendWelcomeEmail, resendWelcomeEmail } = require("../../utils");
// const UsersDatabase = require("../../models/User");
// const router = express.Router();
// const { v4: uuidv4 } = require("uuid");

// // Function to generate a referral code
// function generateReferralCode(length) {
//   const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
//   let code = "";

//   for (let i = 0; i < length; i++) {
//     const randomIndex = Math.floor(Math.random() * characters.length);
//     code += characters.charAt(randomIndex);
//   }

//   return code;
// }



// // Your registration route

// // Your registration route
// router.post("/register", async (req, res) => {
//   const { firstName, lastName, email, password, country, referralCode } = req.body;

//   try {
//     // Check if any user has that email
//     const user = await UsersDatabase.findOne({ email });

//     if (user) {
//       return res.status(400).json({
//         success: false,
//         message: "Email address is already taken",
//       });
//     }

//     // Find the referrer based on the provided referral code
//     let referrer = null;
//     if (referralCode) {
//       referrer = await UsersDatabase.findOne({ referralCode });
//       // You can remove the code that checks for a valid referral code here

//       // Optionally, you can handle the case where the referral code is invalid
//       // by setting referrer to null and proceeding with registration
//     }

//     // Create a new user with referral information
//     const newUser = {
//       firstName,
//       lastName,
//       email,
//       password: hashPassword(password),
//       country,
//       amountDeposited: 0,
//       profit: 0,
//       balance: 0,
//       referalBonus: 0,
//       transactions: [],
//       withdrawals: [],
//       accounts: {
//         eth: {
//           address: "",
//         },
//         ltc: {
//           address: "",
//         },
//         btc: {
//           address: "",
//         },
//         usdt: {
//           address: "",
//         },
//       },
//       verified: false,
//       isDisabled: false,
//       referralCode: generateReferralCode(6), // Generate a referral code for the new user
//       referredBy: referrer ? referrer._id : null, // Store the ID of the referrer if applicable
//       referredUsers: [], // Initialize the referredUsers property as an empty array
//     };

//     // Create the new user in the database
//     const createdUser = await User.create(newUser);
//     const token = uuidv4();
//     sendWelcomeEmail({ to: email, token });

//     // If there's a referrer, update their referredUsers list
//     if (referrer) {
//       referrer.referredUsers.push(createdUser._id);
//       await referrer.save();
//     }

//     return res.status(200).json({ code: "Ok", data: createdUser });
//   } catch (error) {
//     console.error("Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// });
module.exports = router;
