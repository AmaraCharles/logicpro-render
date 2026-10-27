// Core Dependencies
const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

// Route Files
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");
const loginAuthRouter = require("./routes/auth/login");
const traderAuthRouter = require("./routes/auth/trader");

const verifyAuthRouter = require("./routes/auth/verify-email");
const registerAuthRouter = require("./routes/auth/register");
const forgotPasswordAuthRouter = require("./routes/auth/forgot-password");
const kycAuthRouter = require("./routes/auth/kyc");
const transactionsRouter = require("./routes/transactions");
const settingsRouter = require("./routes/settings");
const wireTransferSettingsRouter = require('./routes/Wiretransfersettings')
const demoSettingsRouter = require("./routes/demoSettings");
// App Initialization
const app = express();
const PORT = process.env.PORT || 8080;

// Render sits one proxy hop in front of us — lets req.ip be the real client.
app.set("trust proxy", 1);

// Middleware
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

// Routes
app.use("/", indexRouter);
app.use("/users", usersRouter);
app.use("/auth", loginAuthRouter);
app.use("/auth", verifyAuthRouter);
app.use("/auth", registerAuthRouter);
app.use("/auth", forgotPasswordAuthRouter);
app.use("/auth", kycAuthRouter);
app.use("/auth/trader", traderAuthRouter);
app.use("/transactions", transactionsRouter);
app.use("/settings", settingsRouter);
app.use("/wire-transfer-settings",wireTransferSettingsRouter);
app.use("/demo-settings", demoSettingsRouter);

// MongoDB Connection
mongoose.set('strictQuery', false);
const dbConnectionString = process.env.DB_CONNECTION_STRING || "";
if (!dbConnectionString) {
  console.error("Error: DB_CONNECTION_STRING environment variable is not set.");
  process.exit(1);
}
mongoose.connect(dbConnectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on("error", () => console.error("❌ Database connection error"));
db.once("open", () => console.log("✅ Database connected successfully"));

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
