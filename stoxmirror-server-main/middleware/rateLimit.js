// Small in-memory fixed-window rate limiter (no extra dependency).
// Per-process only — good enough for a single Render instance; swap for a
// shared store if the API is ever scaled horizontally.
function rateLimit({ windowMs, max, keyFn, message }) {
  const hits = new Map();

  // Drop expired windows so the map can't grow without bound.
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return function (req, res, next) {
    const key = (keyFn ? keyFn(req) : null) || clientIp(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message: message || "Too many requests, try again later" });
    }
    next();
  };
}

// Uses req.ip (app sets `trust proxy` to 1 hop) rather than reading
// X-Forwarded-For directly — its leftmost entry is client-controlled.
function clientIp(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
}

module.exports = { rateLimit, clientIp };
