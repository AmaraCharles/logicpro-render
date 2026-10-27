// Live USD prices for the in-app converter/holdings.
// Prices are fetched server-side (never trusted from the client) because
// conversions move real balance. Results are cached briefly and fall back to
// a static table if the upstream feed is unavailable.
const axios = require("axios");

// App symbol -> CoinGecko id
const COIN_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tether",
  BNB: "binancecoin",
  SOL: "solana",
  XRP: "ripple",
  USDC: "usd-coin",
  ADA: "cardano",
  DOGE: "dogecoin",
  TRX: "tron",
  TON: "the-open-network",
  AVAX: "avalanche-2",
  SHIB: "shiba-inu",
  DOT: "polkadot",
  LINK: "chainlink",
  MATIC: "matic-network",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  XLM: "stellar",
  UNI: "uniswap",
};

// Used when the live feed can't be reached, so conversions never hard-fail.
const FALLBACK = {
  BTC: 67250, ETH: 3480.5, USDT: 1, BNB: 585.2, SOL: 152.3, XRP: 0.52,
  USDC: 1, ADA: 0.38, DOGE: 0.12, TRX: 0.16, TON: 5.4, AVAX: 27.8,
  SHIB: 0.000018, DOT: 4.3, LINK: 11.2, MATIC: 0.42, LTC: 84.2,
  BCH: 395, XLM: 0.11, UNI: 7.8,
};

const CACHE_TTL_MS = 30000;
let cache = { at: 0, prices: null };

function pick(prices, symbols) {
  if (!symbols) return prices;
  const out = {};
  symbols.forEach((s) => { out[s] = s === "USD" ? 1 : prices[s]; });
  return out;
}

// Returns { USD: 1, BTC: <usd>, ... }. If `symbols` is given, only those.
async function getLivePrices(symbols) {
  const now = Date.now();
  if (cache.prices && now - cache.at < CACHE_TTL_MS) return pick(cache.prices, symbols);

  try {
    const ids = Object.values(COIN_IDS).join(",");
    const { data } = await axios.get("https://api.coingecko.com/api/v3/simple/price", {
      params: { ids, vs_currencies: "usd" },
      timeout: 5000,
    });
    const prices = { USD: 1 };
    for (const [sym, id] of Object.entries(COIN_IDS)) {
      const p = data && data[id] && data[id].usd;
      prices[sym] = typeof p === "number" && p > 0 ? p : FALLBACK[sym];
    }
    cache = { at: now, prices };
    return pick(prices, symbols);
  } catch (err) {
    console.warn("getLivePrices: live feed unavailable, using fallback:", err.message);
    return pick({ USD: 1, ...FALLBACK }, symbols);
  }
}

module.exports = { getLivePrices, COIN_IDS, FALLBACK };
