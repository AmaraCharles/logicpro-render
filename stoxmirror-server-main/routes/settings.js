var express = require("express");
const crypto = require("crypto");
const Settings = require("../models/Settings");
const WalletAuditLog = require("../models/WalletAuditLog");
const { requireActiveAdmin } = require("../middleware/auth");
const { rateLimit, clientIp } = require("../middleware/rateLimit");
const { compareHashedPassword, sendWalletChangeAlert } = require("../utils");
var router = express.Router();

/* =====================================================================
   Crypto deposit wallets.
   - There are NO default/seeded addresses: the Fund Account page only
     offers wallets an admin has saved here.
   - Writes need a still-active admin in the DB (requireActiveAdmin), the
     admin's current password (so a stolen token alone can't redirect
     deposits), the version the admin loaded (no blind overwrites), and
     are rate limited per admin.
   - Every address is validated against its network's format.
   - The saved list is HMAC-signed with a server-side secret; if the DB
     row is edited behind the API's back the public endpoint refuses to
     serve it rather than show a possibly attacker-controlled address.
   - Every change and every rejected attempt is written to WalletAuditLog
     and emailed to support.
   ===================================================================== */

const MAX_WALLETS = 20;

const BASE58 = "1-9A-HJ-NP-Za-km-z";
const BECH32 = "ac-hj-np-z02-9";
const NETWORKS = {
  bitcoin: { name: "Bitcoin (BTC)", re: new RegExp(`^(bc1[${BECH32}]{25,87}|[13][${BASE58}]{25,34})$`) },
  evm: { name: "Ethereum / EVM (ERC-20, BEP-20, Polygon…)", re: /^0x[a-fA-F0-9]{40}$/ },
  tron: { name: "Tron (TRX / TRC-20)", re: new RegExp(`^T[${BASE58}]{33}$`) },
  solana: { name: "Solana (SOL / SPL)", re: new RegExp(`^[${BASE58}]{32,44}$`) },
  litecoin: { name: "Litecoin (LTC)", re: new RegExp(`^(ltc1[${BECH32}]{25,87}|[LM3][${BASE58}]{26,33})$`) },
  dogecoin: { name: "Dogecoin (DOGE)", re: new RegExp(`^[DA9][${BASE58}]{25,34}$`) },
};

const KEY_RE = /^[a-z][a-z0-9_]{1,31}$/;
const LABEL_RE = /^[A-Za-z0-9 ()._\/-]{1,40}$/;
// Keys the Fund Account page already uses for non-crypto methods, plus
// anything that could clash with object internals.
const RESERVED_KEYS = new Set(["wire", "demo", "constructor", "prototype", "hasownproperty", "tostring", "valueof"]);

// Signing key never lives in the DB. Set WALLET_SIGNING_SECRET to rotate it
// independently; otherwise it's derived from JWT_SECRET.
const SIGNING_KEY = process.env.WALLET_SIGNING_SECRET
  ? Buffer.from(process.env.WALLET_SIGNING_SECRET)
  : crypto.createHmac("sha256", process.env.JWT_SECRET).update("deposit-wallet-integrity-v1").digest();

function plainWallets(list) {
  return (list || []).map((w) => ({
    key: w.key,
    label: w.label,
    network: w.network,
    address: w.address,
    enabled: w.enabled !== false,
  }));
}

function signWallets(wallets, version) {
  const canonical = JSON.stringify({
    v: version,
    w: wallets.map((w) => [w.key, w.label, w.network, w.address, w.enabled]),
  });
  return crypto.createHmac("sha256", SIGNING_KEY).update(canonical).digest("hex");
}

function signatureValid(settings) {
  const wallets = plainWallets(settings.cryptoWallets);
  const version = settings.walletsVersion || 0;
  if (!wallets.length && version === 0) return true; // nothing saved yet
  const expected = Buffer.from(signWallets(wallets, version), "hex");
  const actual = Buffer.from(String(settings.walletsSignature || ""), "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

// Strict allowlist validation — builds fresh objects so nothing unexpected
// from the request body is ever persisted.
function validateWallets(input) {
  if (!Array.isArray(input)) return { error: "wallets must be an array" };
  if (input.length > MAX_WALLETS) return { error: `At most ${MAX_WALLETS} wallets are allowed` };

  const seen = new Set();
  const out = [];
  for (let i = 0; i < input.length; i++) {
    const entry = input[i];
    const where = `Wallet #${i + 1}`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return { error: `${where}: invalid entry` };

    const { key, label, network, address, enabled } = entry;
    if (typeof key !== "string" || !KEY_RE.test(key)) {
      return { error: `${where}: id must be 2-32 chars, lowercase letters, digits or _ and start with a letter` };
    }
    if (RESERVED_KEYS.has(key)) return { error: `${where}: "${key}" is a reserved id` };
    if (seen.has(key)) return { error: `${where}: duplicate id "${key}"` };
    seen.add(key);

    if (typeof label !== "string" || !LABEL_RE.test(label.trim())) {
      return { error: `${where}: label must be 1-40 chars (letters, digits, spaces, ( ) . _ / -)` };
    }
    if (typeof network !== "string" || !Object.prototype.hasOwnProperty.call(NETWORKS, network)) {
      return { error: `${where}: unknown network` };
    }
    if (typeof address !== "string" || !NETWORKS[network].re.test(address.trim())) {
      return { error: `${where} (${label}): "${String(address).slice(0, 100)}" is not a valid ${NETWORKS[network].name} address` };
    }
    if (enabled !== undefined && typeof enabled !== "boolean") return { error: `${where}: enabled must be true/false` };

    out.push({ key, label: label.trim(), network, address: address.trim(), enabled: enabled !== false });
  }
  return { wallets: out };
}

async function audit(req, fields) {
  try {
    await WalletAuditLog.create({
      adminId: String((req.admin && req.admin.userId) || ""),
      adminEmail: (req.admin && req.admin.email) || "",
      ip: clientIp(req),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
      ...fields,
    });
  } catch (error) {
    console.error("Failed to write wallet audit log:", error);
  }
}

function noStore(req, res, next) {
  res.set("Cache-Control", "no-store, max-age=0");
  res.set("Pragma", "no-cache");
  next();
}

const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const adminReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyFn: (req) => "admin-read:" + clientIp(req),
});
// Per-admin and per-IP caps on write attempts: also caps password guessing
// with a stolen token.
const writeLimiterByIp = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyFn: (req) => "wallet-write-ip:" + clientIp(req),
  message: "Too many wallet update attempts. Try again in a minute.",
});
const writeLimiterByAdmin = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyFn: (req) => "wallet-write-admin:" + req.admin.userId,
  message: "Too many wallet update attempts. Try again in a minute.",
});

// Public: the Fund Account page lists only enabled, admin-saved wallets.
router.get("/wallets", publicLimiter, noStore, async function (req, res) {
  try {
    const settings = await Settings.findOne({ key: "global" });
    if (!settings) return res.status(200).json({ code: "Ok", data: [] });

    if (!signatureValid(settings)) {
      console.error("🚨 [settings.wallets] INTEGRITY CHECK FAILED — wallets in DB were not saved through the admin API. Refusing to serve them.");
      return res.status(503).json({ message: "Deposit wallets are temporarily unavailable" });
    }

    const data = plainWallets(settings.cryptoWallets)
      .filter((w) => w.enabled)
      .map(({ key, label, network, address }) => ({ key, label, network, address }));
    res.status(200).json({ code: "Ok", data });
  } catch (error) {
    console.error("Error fetching deposit wallets:", error);
    res.status(500).json({ message: "Failed to fetch deposit wallets" });
  }
});

// Admin: full list (incl. disabled), version for the next save, and history.
router.get("/wallets/admin", adminReadLimiter, noStore, requireActiveAdmin, async function (req, res) {
  try {
    const settings = await Settings.findOne({ key: "global" });
    const history = await WalletAuditLog.find({})
      .sort({ at: -1 })
      .limit(25)
      .select("at action reason adminEmail ip fromVersion toVersion before after")
      .lean();

    res.status(200).json({
      code: "Ok",
      data: {
        wallets: settings ? plainWallets(settings.cryptoWallets) : [],
        version: (settings && settings.walletsVersion) || 0,
        updatedAt: (settings && settings.walletsUpdatedAt) || null,
        updatedBy: (settings && settings.walletsUpdatedBy) || "",
        integrityOk: settings ? signatureValid(settings) : true,
        networks: Object.entries(NETWORKS).map(([id, n]) => ({ id, name: n.name })),
        history,
      },
    });
  } catch (error) {
    console.error("Error fetching deposit wallets (admin):", error);
    res.status(500).json({ message: "Failed to fetch deposit wallets" });
  }
});

// Admin: replace the whole set of deposit wallets.
// Body: { wallets: [{ key, label, network, address, enabled }], version, currentPassword }
router.put("/wallets", writeLimiterByIp, noStore, requireActiveAdmin, writeLimiterByAdmin, async function (req, res) {
  const { wallets, version, currentPassword } = req.body || {};

  if (typeof currentPassword !== "string" || !currentPassword) {
    return res.status(400).json({ message: "Your current password is required to change deposit wallets" });
  }
  let passwordOk = false;
  try {
    passwordOk = !!req.adminUser.password && compareHashedPassword(req.adminUser.password, currentPassword);
  } catch (e) {
    passwordOk = false;
  }
  if (!passwordOk) {
    await audit(req, { action: "denied", reason: "wrong password" });
    console.warn(`[settings.wallets] wrong password on wallet update by ${req.admin.email} from ${clientIp(req)}`);
    return res.status(403).json({ message: "Incorrect password" });
  }

  if (!Number.isInteger(version) || version < 0) {
    return res.status(400).json({ message: "version is required — reload the page and try again" });
  }

  const result = validateWallets(wallets);
  if (result.error) return res.status(400).json({ message: result.error });

  try {
    const current = await Settings.findOne({ key: "global" });
    const currentVersion = (current && current.walletsVersion) || 0;
    if (version !== currentVersion) {
      await audit(req, { action: "denied", reason: `version conflict (sent ${version}, current ${currentVersion})` });
      return res.status(409).json({ message: "Wallets were changed by someone else since you loaded them. Reload and try again." });
    }

    const before = current ? plainWallets(current.cryptoWallets) : [];
    const nextVersion = currentVersion + 1;
    const now = new Date();

    // Conditional on the version so two simultaneous saves can't both win.
    let saved;
    try {
      saved = await Settings.findOneAndUpdate(
        { key: "global", walletsVersion: currentVersion === 0 ? { $in: [0, null] } : currentVersion },
        {
          $set: {
            cryptoWallets: result.wallets,
            walletsVersion: nextVersion,
            walletsSignature: signWallets(result.wallets, nextVersion),
            walletsUpdatedAt: now,
            walletsUpdatedBy: req.admin.email,
          },
          $unset: { depositWallets: 1 },
        },
        { new: true, upsert: true }
      );
    } catch (error) {
      if (error && error.code === 11000) saved = null; // lost the race against another save
      else throw error;
    }
    if (!saved || saved.walletsVersion !== nextVersion) {
      await audit(req, { action: "denied", reason: "concurrent update" });
      return res.status(409).json({ message: "Wallets were changed by someone else since you loaded them. Reload and try again." });
    }

    await audit(req, { action: "update", fromVersion: currentVersion, toVersion: nextVersion, before, after: result.wallets });
    console.log(
      `[settings.wallets] v${currentVersion} -> v${nextVersion} by ${req.admin.email} (userId=${req.admin.userId}) from ${clientIp(req)} at ${now.toISOString()}:`,
      result.wallets
    );
    sendWalletChangeAlert({
      adminEmail: req.admin.email,
      ip: clientIp(req),
      timestamp: now.toISOString(),
      before,
      after: result.wallets,
    }).catch((e) => console.error("Wallet change alert email failed:", e));

    res.status(200).json({
      code: "Ok",
      data: { wallets: plainWallets(saved.cryptoWallets), version: saved.walletsVersion, updatedAt: now, updatedBy: req.admin.email },
    });
  } catch (error) {
    console.error("Error updating deposit wallets:", error);
    res.status(500).json({ message: "Failed to update deposit wallets" });
  }
});

/* =====================================================================
   Investment / deposit plans.
   - GET /settings/plans is public (the dashboard shows these to users).
   - PUT /settings/plans replaces the catalog and needs an active admin.
   - If no plans have been saved yet, the default catalog is returned.
   ===================================================================== */

const DEFAULT_PLANS = [
  { id: "basic",   name: "Basic Package",     minInvestment: 3000,    maxInvestment: 25000,      dailyProfitRate: 0.004, duration: 30,   description: "Perfect for beginners looking to start their investment journey", color: "hsl(30, 60%, 50%)" },
  { id: "silver",  name: "Silver Plan",       minInvestment: 25000,   maxInvestment: 50000,      dailyProfitRate: 0.005, duration: 30,   description: "Balanced plan for steady, diversified growth",                    color: "hsl(0, 0%, 70%)" },
  { id: "gold",    name: "Gold Plan",         minInvestment: 100000,  maxInvestment: 300000,     dailyProfitRate: 0.006, duration: 30,   description: "Premium plan for serious investors",                              color: "hsl(45, 100%, 50%)" },
  { id: "diamond", name: "Diamond Plan",      minInvestment: 300000,  maxInvestment: 500000,     dailyProfitRate: 0.013, duration: 1095, description: "Elite plan with exclusive benefits",                              color: "hsl(195, 70%, 60%)" },
  { id: "ultimate",name: "Ultimate Plan",     minInvestment: 1000000, maxInvestment: 3000000,    dailyProfitRate: 0.013, duration: 1095, description: "Elite plan with exclusive benefits",                              color: "hsl(195, 70%, 60%)" },
  { id: "inner",   name: "inner circle Plan", minInvestment: 5000000, maxInvestment: "unlimited", dailyProfitRate: 0.064, duration: 7,    description: "Elite plan with exclusive benefits",                              color: "hsl(195, 70%, 60%)" },
];

router.get("/plans", publicLimiter, noStore, async function (req, res) {
  try {
    const settings = await Settings.findOne({ key: "global" });
    const plans = settings && Array.isArray(settings.plans) && settings.plans.length
      ? settings.plans
      : DEFAULT_PLANS;
    res.status(200).json({ code: "Ok", data: plans });
  } catch (error) {
    console.error("GET /settings/plans failed:", error);
    res.status(500).json({ message: "Failed to fetch plans" });
  }
});

router.put("/plans", writeLimiterByIp, noStore, requireActiveAdmin, async function (req, res) {
  const { plans } = req.body;

  if (!Array.isArray(plans)) {
    return res.status(400).json({ message: "plans must be an array" });
  }
  if (plans.length > 50) {
    return res.status(400).json({ message: "Too many plans (max 50)" });
  }
  // Minimal per-plan validation; fields are stored loosely otherwise.
  for (const p of plans) {
    if (!p || typeof p !== "object") {
      return res.status(400).json({ message: "Each plan must be an object" });
    }
    if (typeof p.name !== "string" || !p.name.trim()) {
      return res.status(400).json({ message: "Each plan needs a name" });
    }
  }

  try {
    const saved = await Settings.findOneAndUpdate(
      { key: "global" },
      { $set: { plans } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ code: "Ok", message: "Plans updated", data: saved.plans });
  } catch (error) {
    console.error("PUT /settings/plans failed:", error);
    res.status(500).json({ message: "Failed to update plans" });
  }
});

/* =====================================================================
   Investment plans — a separate catalog from staking `plans`, same shape,
   same admin controls.
   ===================================================================== */

const DEFAULT_INVESTMENT_PLANS = [
  { id: "starter_fund", name: "Starter Fund", minInvestment: 500,   maxInvestment: 5000,       dailyProfitRate: 0.003, capMultiple: 1.5, duration: 60,  description: "Entry-level managed fund for first-time investors", color: "hsl(210, 70%, 55%)" },
  { id: "growth_fund",  name: "Growth Fund",  minInvestment: 5000,  maxInvestment: 50000,      dailyProfitRate: 0.005, capMultiple: 2,   duration: 90,  description: "Balanced growth across a diversified portfolio",     color: "hsl(160, 60%, 45%)" },
  { id: "premium_fund", name: "Premium Fund", minInvestment: 50000, maxInvestment: "unlimited", dailyProfitRate: 0.007, capMultiple: 2.5, duration: 120, description: "Actively managed fund for high-net-worth investors",  color: "hsl(45, 90%, 55%)" },
];

router.get("/investment-plans", publicLimiter, noStore, async function (req, res) {
  try {
    const settings = await Settings.findOne({ key: "global" });
    const plans = settings && Array.isArray(settings.investmentPlans) && settings.investmentPlans.length
      ? settings.investmentPlans
      : DEFAULT_INVESTMENT_PLANS;
    res.status(200).json({ code: "Ok", data: plans });
  } catch (error) {
    console.error("GET /settings/investment-plans failed:", error);
    res.status(500).json({ message: "Failed to fetch investment plans" });
  }
});

router.put("/investment-plans", writeLimiterByIp, noStore, requireActiveAdmin, async function (req, res) {
  const { plans } = req.body;

  if (!Array.isArray(plans)) {
    return res.status(400).json({ message: "plans must be an array" });
  }
  if (plans.length > 50) {
    return res.status(400).json({ message: "Too many plans (max 50)" });
  }
  for (const p of plans) {
    if (!p || typeof p !== "object") {
      return res.status(400).json({ message: "Each plan must be an object" });
    }
    if (typeof p.name !== "string" || !p.name.trim()) {
      return res.status(400).json({ message: "Each plan needs a name" });
    }
  }

  try {
    const saved = await Settings.findOneAndUpdate(
      { key: "global" },
      { $set: { investmentPlans: plans } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ code: "Ok", message: "Investment plans updated", data: saved.investmentPlans });
  } catch (error) {
    console.error("PUT /settings/investment-plans failed:", error);
    res.status(500).json({ message: "Failed to update investment plans" });
  }
});

module.exports = router;
