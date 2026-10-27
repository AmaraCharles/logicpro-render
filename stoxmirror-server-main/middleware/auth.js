const jwt = require("jsonwebtoken");
const UsersDatabase = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // Fail loud at boot rather than silently signing/verifying tokens with
  // "undefined" — that would let anyone forge a valid admin token.
  throw new Error("JWT_SECRET environment variable is not set.");
}

function signAdminToken(user) {
  return jwt.sign(
    { userId: user._id, email: user.email, isAdmin: true },
    JWT_SECRET,
    { expiresIn: "12h", algorithm: "HS256" }
  );
}

// Protects admin-only routes. Expects `Authorization: Bearer <token>`.
function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Missing or invalid authorization header" });
  }

  try {
    // Pin the algorithm so a token can't pick its own (e.g. "none").
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    req.admin = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

// Stricter variant for high-value routes (e.g. deposit wallets): on top of a
// valid admin JWT, the account must *still* be an enabled admin in the
// database right now. A token issued before an admin was demoted or disabled
// stops working immediately instead of living out its 12h expiry.
function requireActiveAdmin(req, res, next) {
  requireAdmin(req, res, async function () {
    try {
      const user = await UsersDatabase.findById(req.admin.userId);
      if (
        !user ||
        user.isAdmin !== true ||
        user.isDisabled === true ||
        user.condition === "disabled" ||
        String(user.email).toLowerCase() !== String(req.admin.email).toLowerCase()
      ) {
        return res.status(403).json({ message: "Admin access required" });
      }
      req.adminUser = user;
      next();
    } catch (error) {
      console.error("requireActiveAdmin lookup failed:", error);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  });
}

module.exports = { signAdminToken, requireAdmin, requireActiveAdmin };
