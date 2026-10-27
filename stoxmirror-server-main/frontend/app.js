// ==================== USER DATA MANAGEMENT ====================
function apiLog(action, data) {
  const logs = JSON.parse(localStorage.getItem('apiLogs') || '[]');
  logs.push({
    timestamp: new Date().toISOString(),
    action,
    data
  });
  localStorage.setItem('apiLogs', JSON.stringify(logs));
  console.log('API Call:', action, data);
}
// ==================== CURRENCY ====================
// Every amount is stored in USD (admins always enter USD). Each user sees
// amounts converted into the currency they picked at registration, and the
// amounts they type are in that currency and converted back to USD before
// anything is validated or sent to the server.
const FX_CACHE_KEY = 'fxRatesUSD';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // refresh rates every 6 hours
let fxCurrency = 'USD';
let fxRate = 1; // units of fxCurrency per 1 USD

// Turn any money-ish value into a number: 1234.5, "1,234.50", "1.234,50",
// "$ 5,000", "₦12,500.75" ... (thousands separators and symbols never break it)
function parseAmount(value) {
  if (typeof value === 'number') return isFinite(value) ? value : 0;
  if (value == null) return 0;
  let s = String(value).trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // both present: whichever comes last is the decimal separator
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    // "1,234" / "1,234,567" are thousands; "12,5" is a decimal comma
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,(?=.*,)/g, '').replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    // "1.234.567" — dots used as thousands separators
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

// Pull a 3-letter ISO code out of whatever was stored ("NGN", "ngn",
// "NGN — Nigerian Naira", "NGN, Nigerian Naira" ...)
function extractCurrencyCode(value) {
  const m = String(value || '').toUpperCase().match(/\b[A-Z]{3}\b/);
  return m ? m[0] : 'USD';
}

async function loadUsdRates() {
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY) || 'null'); } catch (e) {}
  if (cached && cached.rates && Date.now() - cached.ts < FX_TTL_MS) return cached.rates;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data && data.result === 'success' && data.rates) {
      localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ ts: Date.now(), rates: data.rates }));
      return data.rates;
    }
  } catch (e) {
    console.warn('Could not load exchange rates:', e);
  }
  return cached && cached.rates ? cached.rates : null; // stale rates beat none
}

async function initCurrency() {
  const user = JSON.parse(localStorage.getItem('userData') || '{}');
  const code = extractCurrencyCode(user.currency);
  fxCurrency = 'USD';
  fxRate = 1;
  if (code !== 'USD') {
    const rates = await loadUsdRates();
    if (rates && rates[code]) {
      fxCurrency = code;
      fxRate = Number(rates[code]);
    } else {
      console.warn(`No exchange rate for ${code}; showing USD instead`);
    }
  }
  // static labels in index.html modals
  document.querySelectorAll('[data-currency-label]').forEach(el => {
    el.textContent = `${el.dataset.currencyLabel} (${currencySymbol()})`;
  });
}

const round2 = n => Math.round(n * 100) / 100;
function toLocal(usd) { return parseAmount(usd) * fxRate; }
function toUSD(local) { return round2(parseAmount(local) / fxRate); }

function formatLocal(localAmount) {
  const n = parseAmount(localAmount);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: fxCurrency, currencyDisplay: 'narrowSymbol' }).format(n);
  } catch (e) {
    return `${fxCurrency} ${n.toFixed(2)}`;
  }
}
// Format a stored USD amount in the user's currency
function money(usd) { return formatLocal(toLocal(usd)); }

function currencySymbol() {
  try {
    const part = new Intl.NumberFormat(undefined, { style: 'currency', currency: fxCurrency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find(p => p.type === 'currency');
    return part ? part.value : fxCurrency;
  } catch (e) {
    return fxCurrency;
  }
}

// Initialize user data structure — requires a logged-in user (set by login.html)
function initUserData() {
  const existingUser = localStorage.getItem('userData');
  if (!existingUser) {
    window.location.href = '/login';
    return null;
  }
  return JSON.parse(existingUser);
}

// Investment Plans Definition
function getInvestmentPlans() {
  const plans = localStorage.getItem('investmentPlans');
  if (!plans) {
    const defaultPlans = [
     {
        id: 'basic',
        name: 'Basic Package',
        minInvestment: 3000,
        maxInvestment: 25000,
        dailyProfitRate: 0.004, // 2% daily
        duration: 30, // days
        durationn: 24, // days
        description: 'Perfect for beginners looking to start their investment journey',
        color: 'hsl(30, 60%, 50%)'
      },
      {
        id: 'silver',
        name: 'Silver Plan',
        minInvestment: 25000,
        maxInvestment: 50000,
        dailyProfitRate: 0.005, // 3.5% daily
        duration: 30,
         durationn: 720, // days
        description: 'Balanced plan for steady growth and reliable returns',
        color: 'hsl(0, 0%, 70%)'
      },
      {
        id: 'gold',
        name: 'Gold Plan',
        minInvestment: 100000,
        maxInvestment: 300000,
        dailyProfitRate: 0.006, // 5% daily
        duration: 30,
        monthly:0.40,
         durationn: 720, // days
        description: 'Premium plan with high returns for serious investors',
        color: 'hsl(45, 100%, 50%)'
      },
      {
        id: 'diamond',
        name: 'Diamond Plan',
        minInvestment: 300000,
        maxInvestment: 500000,
        dailyProfitRate: 0.013, // 7.5% daily
        duration: 1095,
         durationn: 26280,
           monthly:0.40, // days
        description: 'Elite plan for maximum profit and exclusive benefits',
        color: 'hsl(195, 70%, 60%)'
      },
       {
        id: 'ultimate',
        name: 'Ultimate Plan',
        minInvestment: 1000000,
        maxInvestment: 3000000,
        dailyProfitRate: 0.013, // 7.5% daily
        duration: 1095,
         durationn: 26280, // hours
         monthly:0.40,
        description: 'Elite plan for maximum profit and exclusive benefits',
        color: 'hsl(195, 70%, 60%)'
      },
       {
        id: 'inner',
        name: 'inner circle Plan',
        minInvestment: 5000000,
        maxInvestment: "unlimited",
        dailyProfitRate: 0.064, // 7.5% daily
        duration: 7,
         durationn: 120, // days
        description: 'Elite plan for maximum profit and exclusive benefits',
        color: 'hsl(195, 70%, 60%)'
      }
      
    ];

    localStorage.removeItem('investmentPlans');
    localStorage.setItem('investmentPlans', JSON.stringify(defaultPlans));
    return defaultPlans;
  }
  return JSON.parse(plans);
}

// Update investment plans
function updateInvestmentPlans(plans) {
  localStorage.setItem('investmentPlans', JSON.stringify(plans));
  apiLog('INVESTMENT_PLANS_UPDATED', { count: plans.length });
}

// Get user data
// Fetch fresh user from backend (async)
async function getUser() {
  const parsedData = localStorage.getItem("userData");
  if (!parsedData) return null;

  const userFromLS = JSON.parse(parsedData);

  try {
    const response = await $.ajax({
      type: "GET",
      url: `https://vantage-render.onrender.com/users/${userFromLS.email}`,
      dataType: "json",
      timeout: 30000,
    });

    // update local storage with latest data
    localStorage.setItem("userData", JSON.stringify(response.data));
    console.log("✅ User refreshed from server");
    return response.data;
  } catch (error) {
    console.error("❌ Error fetching user:", error);
    return userFromLS; // fallback to local version
  }
}

// Return cached user data immediately (not async)
function getUserData() {
  const parsedData = localStorage.getItem("userData");
  if (!parsedData) return null;

  const user = JSON.parse(parsedData);

  // 🔹 silently refresh user info in background (non-blocking)
  getUser().then((updatedUser) => {
    if (updatedUser) {
      localStorage.setItem("userData", JSON.stringify(updatedUser));
    }
  });

  // 🔹 return current cached user immediately
  return user;
}

function updateUserData(updates) {
  const user = getUserData();
  const updatedUser = { ...user, ...updates };
  localStorage.setItem('userData', JSON.stringify(updatedUser));
  return updatedUser;
}
// Add transaction
// function addTransaction(transaction) {
//   const user = getUserData();
//   const newTransaction = {
//     id: Date.now().toString(),
//     timestamp: new Date().toISOString(),
//     ...transaction
//   };
//   user.transactions.push(newTransaction);
//   updateUserData(user);
//   apiLog('TRANSACTION_ADDED', newTransaction);
//   return newTransaction;
// }


async function addTransaction(dataObj) {
  
    const user = getUserData();
    console.log(user);
    
  const newTransaction = {
    userId: user._id,
    to:user.email,
    from:user.firstName + " "+user.lastName,
    timestamp: new Date().toISOString(),
    ...dataObj
  };
  
console.log(newTransaction);

    try {
      const data = await $.ajax({
        type: "POST",
        url: `https://vantage-render.onrender.com/transactions/${newTransaction.userId}/deposit`,
        dataType: "json",
        data: { ...newTransaction },
        timeout: 30000,
      });

      localStorage.removeItem("ct");
      // await commandTrade(data.tradeId, "true");

      console.log(data.tradeId);
      Swal.fire({
        title: "Deposit",
        text: "Deposit was successfully sent. Please wait a few minutes for account update",
        icon: "success",
        timer: 3000,
        showConfirmButton: false
      });
   renderInvestmentPage();
      // setTimeout(() => {
      //   window.location.href = "./transactions.html";
      // }, 3000);

    } catch (error) {
      console.error("Error Submitting Payment Data:", error);
      alert("Error Submitting Payment Data");
      setReady();
    }
  }


/// Add withdrawal (vanilla JS API version)
async function addWithdrawal(withdrawal) {
  const user = getUserData(); // assumes user data stored locally

  // Build the data object exactly as React expects
  const dataObj = {
    amount: withdrawal.amount,
    method: withdrawal.method,
    address: withdrawal.address,
    source:withdrawal.source,
    _id: user._id,
     to:user.email,
    from: user.firstName +" "+user.lastName,
    timestamp: new Date().toISOString(),
    balance: user.balance
  };

  try {
    apiLog("WITHDRAWAL_REQUEST", dataObj);

    // 🔹 Send POST request to backend API
    const response = await fetch(`https://vantage-render.onrender.com/transactions/${dataObj._id}/withdrawal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(dataObj)
    });

    // 🔹 Parse response
    const result = await response.json();

    if (response.ok) {
      apiLog("WITHDRAWAL_SUCCESS", result);
      Swal.fire({
        icon: "success",
        title: "Withdrawal Requested!",
        text: "Your withdrawal request has been submitted successfully.",
      });

      // Optional: update local data
      user.withdrawals = user.withdrawals || [];
      user.withdrawals.push(result);
      updateUserData(user);
      return result;
    } else {
      // apiLog("WITHDRAWAL_FAILED", result);
      Swal.fire({
        icon: "error",
        title: "Request Failed",
        text: result.message || "Unable to process withdrawal request.",
      });
    }
  } catch (error) {
    console.error("Withdrawal Error:", error);
    // apiLog("WITHDRAWAL_ERROR", error);
    Swal.fire({
      icon: "error",
      title: "Network Error",
      text: "Unable to connect to the server. Please try again later.",
    });
  }
}


// Claim reward
function claimReward(rewardId) {
  const user = getUserData();
  const reward = user.rewards.find(r => r.id === rewardId);
  if (reward && !reward.claimed) {
    reward.claimed = true;
    user.balance += reward.amount;
    user.referalBonus = (parseFloat(user.referalBonus) + reward.amount).toString();
    updateUserData(user);
    apiLog('REWARD_CLAIMED', { rewardId, amount: reward.amount });
    return true;
  }
  return false;
}

// Add referral
function addReferral(referredEmail) {
  const user = getUserData();
  const newReferral = {
    email: referredEmail,
    dateJoined: new Date().toISOString(),
    status: 'pending',
    earned: 0
  };
  user.referredUsers.push(newReferral);
  updateUserData(user);
  apiLog('REFERRAL_ADDED', newReferral);
  return newReferral;
}

// ==================== INVESTMENT MANAGEMENT ====================

// Purchase investment plan (Frontend)
// Purchase investment plan (Frontend)
async function purchaseInvestmentPlan(planId, amount) {

  console.log("called");
  
  const user = getUserData();
  console.log("user fetched"+user);
  
  const plans = getInvestmentPlans();
  const plan = plans.find(p => p.id === planId);

  if (!plan) return { success: false, error: 'Plan not found' };
  if (amount < plan.minInvestment) return { success: false, error: `Minimum investment is ${money(plan.minInvestment)}` };
  if (amount > plan.maxInvestment) return { success: false, error: `Maximum investment is ${money(plan.maxInvestment)}` };
  if (parseAmount(user.balance) < amount) return { success: false, error: 'Insufficient balance' };

  const now = Date.now();
  const startDate = new Date(now).toISOString();
  const startTime = new Date(now).toISOString(); // keep both if you use them differently
  const endDate = new Date(now + plan.duration * 24 * 60 * 60 * 1000).toISOString(); // duration in days

  const investment = {
    _id: now.toString(),
    planId: plan.id,
    planName: plan.name,
    amount: Number(amount),
    dailyProfitRate: plan.dailyProfitRate,
    duration: plan.duration, // in days
    startDate,
    startTime,
    endDate,
    daysElapsed: 0,
    totalProfit: 0,
    status: 'active', // or 'pending' if you want server confirmation first
    lastProfitUpdate: startDate,
    from: user.from,
    to: user.email,
    timestamp: startDate,
    // reserve fields for trade flow
    command: null,
    profit: 0,
    result: null,
    exitPrice: null
  };


  console.log("lnvestmeant created"+" "+investment);
  

  // Local optimisitic update
  user.balance = Number(user.balance) - Number(amount);
  user.plan = user.plan || [];
  user.plan.push(investment);
  updateUserData(user);
  apiLog('INVESTMENT_PURCHASED_LOCAL', investment);
console.log("sendlng to baclend");
  // Send to backend for persistence
  try {
    const resp = await fetch(`https://vantage-render.onrender.com/transactions/${user._id}/subplan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // match backend payload keys (subname/subamount/from/to/timestamp) or send whole object
        subname: plan.name,
        subamount: Number(amount),
        from: user.from,
        to: user.email,
        timestamp: startDate,
        investmentObject: investment // optional: send full object so backend can store exactly same shape
      })
    });

    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.message || 'Server error');
    }

    apiLog('INVESTMENT_PURCHASED_SERVER', data);
    if (data.success) {
  console.log(data);
  
    Swal.fire({ 
      icon: 'success', 
      title: 'Investment Activated!', 
      html: `Plan purchase success!`,
      confirmButtonText: 'OK' 
    }).then(() => {
      renderInvestmentPage ();
    });
  } 
    return { success: true, investment };
  } catch (err) {
    console.error('API purchase error:', err);
    apiLog('INVESTMENT_PURCHASE_FAILED', { error: err.message, investment });
    // optionally rollback local change or mark as 'failed' locally
    return { success: false, error: err.message };
  }
}



// Calculate and add daily profits
function processDailyProfits() {
  const user = getUserData();
  let totalProfitAdded = 0;
  const now = new Date();
  
  user.plan.forEach(investment => {
    if (investment.status !== 'active') return;
    
    const lastUpdate = new Date(investment.lastProfitUpdate);
    const daysSinceLastUpdate = Math.floor((now - lastUpdate) / (24 * 60 * 60 * 1000));
    
    if (daysSinceLastUpdate > 0) {
      const dailyProfit = investment.amount * investment.dailyProfitRate;
      const profitToAdd = dailyProfit * daysSinceLastUpdate;
      
      investment.daysElapsed += daysSinceLastUpdate;
      investment.totalProfit += profitToAdd;
      investment.lastProfitUpdate = now.toISOString();
      
      user.balance += profitToAdd;
      user.profit += profitToAdd;
      totalProfitAdded += profitToAdd;
      
      // Check if investment has completed
      if (investment.daysElapsed >= investment.duration) {
        investment.status = 'completed';
        // Return principal at the end
        user.balance += investment.amount;
      }
    }
  });
  
  if (totalProfitAdded > 0) {
    updateUserData(user);
    apiLog('DAILY_PROFITS_PROCESSED', { totalProfit: totalProfitAdded });
  }
  
  return totalProfitAdded;
}

// Get active investments
function getPlan() {
  const user = getUserData();
  return user.plan || [];
}

// ==================== THEME & UI ====================

const html = document.documentElement;
const themeToggle = document.getElementById('themeToggle');

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  html.classList.toggle('dark', savedTheme === 'dark');
}

themeToggle.addEventListener('click', () => {
  const isDark = html.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  apiLog('THEME_CHANGED', { theme: isDark ? 'dark' : 'light' });
});
// Sidebar Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');

// ✅ Collapse sidebar by default on page load
sidebar.classList.add('collapsed');

// Toggle sidebar open/close
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

// Close sidebar when clicking the close button
sidebarClose.addEventListener('click', () => {
  sidebar.classList.add('collapsed');
});


// ==================== NAVIGATION ====================

const navLinks = document.querySelectorAll('.nav-link');
const content = document.getElementById('content');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    
    const page = link.dataset.page;
    loadPage(page);
    apiLog('PAGE_NAVIGATION', { page });
  });
});

// Pages that can be restored from the URL after a refresh
const RESTORABLE_PAGES = [
  'market', 'social-trading', 'live-stream', 'trade', 'fund-account', 'profile',
  'investment', 'withdrawal', 'referrals', 'rewards', 'dashboard',
  'investment-plans', 'tradehistory', 'copytradehistory', 'profit-history'
];

function loadPage(page) {
  // remember the page in the URL (e.g. #withdrawal) so a refresh comes back here,
  // and keep the sidebar highlight in sync when a page is opened from a button
  if (RESTORABLE_PAGES.includes(page)) {
    history.replaceState(null, '', '#' + page);
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (navLink) {
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      navLink.classList.add('active');
    }
  }

  switch (page) {
    case 'market':
      renderMarketPage();
      break;
    case 'social-trading':
      renderSocialTradingPage();
      break;
    case 'live-stream':
      renderLiveStreamPage();
      break;
       case 'trade':
     renderTradePage();
      break;
    case 'fund-account':
      renderFundAccountPage();
      break;
    case 'profile':
      renderProfilePage();
      break;
    case 'investment':
     renderInvestmentPage();
      break;
  
    case 'withdrawal':
      renderWithdrawalPage();
      break;
    case 'referrals':
      renderReferralsPage();
      break;
    case 'rewards':
      renderRewardsPage();
      break;
    case 'dashboard':
 
   renderDashboardPage();
      break;
    case 'investment-plans':
     renderInvestmentPlansPage(); 
      break;

       case 'tradehistory':
      renderTradeHistoryPage();
      break;

        case 'copytradehistory':
      renderCopyTradingHistory()
      break;
    case 'profit-history':
      renderProfitHistoryPage();
      break;
    case 'admin':
      renderAdminPage();
      break;
    default:
      renderMarketPage();
  }

  // ✅ Keep sidebar collapsed after loading new page
  if (sidebar) sidebar.classList.add('collapsed');
}


// ==================== STATIC DATA (Only for Master Traders) ====================

// const masterTraders = [
//   {
//     name: 'Ali G',
//     level: 'Guru',
//     rating: 4,
//     trades: 51,
//     commission: 30,
//     pnl: '+$89000.00',
//     profileId: '79697172',
//     accountLevel: 5,
//     followers: 89,
//     watchers: 231,
//     profitableTrade: 70
//   },
//   {
//     name: 'Sarah Chen',
//     level: 'Expert',
//     rating: 5,
//     trades: 128,
//     commission: 25,
//     pnl: '+$142500.00',
//     profileId: '84521963',
//     accountLevel: 7,
//     followers: 234,
//     watchers: 512,
//     profitableTrade: 85
//   },
//   {
//     name: 'Marcus Rivera',
//     level: 'Master',
//     rating: 4,
//     trades: 89,
//     commission: 28,
//     pnl: '+$98750.00',
//     profileId: '73296847',
//     accountLevel: 6,
//     type:"",
//      history,
//     trades,
//     followers: 156,
//     watchers: 387,
//     profitableTrade: 78
//   }
// ];

// ==================== PAGE RENDERERS ====================
// ==================== PROFIT HISTORY PAGE ====================
async function renderProfitHistoryPage() {
  const user = getUserData();
  const content = document.getElementById('content');

  // Show loading state immediately
  content.innerHTML = `
    <div style="padding: 2rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.25rem;">💰 Profit History</h1>
      <p class="text-muted" style="margin-bottom:1.5rem;">All admin profit adjustments on your account</p>
      <div style="text-align:center; padding:3rem; color: hsl(var(--muted-foreground));">Loading...</div>
    </div>
  `;

  let history = [];
  let currentProfit = user.profit || 0;

  try {
    const res = await $.ajax({
      type: "GET",
      url: `https://vantage-render.onrender.com/transactions/${user._id}/profit/history`,
      dataType: "json",
      timeout: 30000,
    });
    if (res.success) {
      history = res.data || [];
      currentProfit = res.currentProfit ?? currentProfit;
    }
  } catch (e) {
    console.warn("Could not fetch profit history from server:", e);
  }

  // Calculate totals
  const totalAdded   = history.filter(e => e.type === "add").reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalDeducted = history.filter(e => e.type === "deduct").reduce((s, e) => s + Number(e.amount || 0), 0);

  const fmt = n => money(n);

  const rowsHtml = history.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:2rem;color:hsl(var(--muted-foreground));">No profit adjustments yet.</td></tr>`
    : history.map(entry => {
        const isAdd = entry.type === "add";
        const color = isAdd ? "hsl(var(--chart-2))" : "hsl(var(--destructive))";
        const icon  = isAdd ? "▲" : "▼";
        const label = isAdd ? "Credit" : "Debit";
        const date  = new Date(entry.date || entry.ts || Date.now()).toLocaleString();
        return `
          <tr>
            <td style="padding:12px 8px;">
              <span style="color:${color}; font-weight:700; font-size:0.85rem;">${icon} ${label}</span>
            </td>
            <td style="padding:12px 8px; font-weight:700; color:${color};">${isAdd ? "+" : "-"}${fmt(entry.amount)}</td>
            <td style="padding:12px 8px; color:hsl(var(--muted-foreground)); font-size:0.85rem;">${entry.note || "—"}</td>
            <td style="padding:12px 8px; font-size:0.85rem;">${fmt(entry.before)} → ${fmt(entry.after)}</td>
            <td style="padding:12px 8px; color:hsl(var(--muted-foreground)); font-size:0.8rem; white-space:nowrap;">${date}</td>
          </tr>
        `;
      }).join("");

  content.innerHTML = `
    <style>
      .ph-card {
        background: hsl(var(--card));
        border: 1px solid hsl(var(--card-border));
        border-radius: 12px;
        padding: 1.25rem 1.5rem;
      }
      .ph-stat { display:flex; flex-direction:column; gap:4px; }
      .ph-stat-label { font-size:0.78rem; color:hsl(var(--muted-foreground)); text-transform:uppercase; letter-spacing:.06em; }
      .ph-stat-value { font-size:1.5rem; font-weight:700; }
      .ph-table { width:100%; border-collapse:collapse; font-size:0.9rem; }
      .ph-table thead th { text-align:left; padding:10px 8px; border-bottom:1px solid hsl(var(--border)); color:hsl(var(--muted-foreground)); font-size:0.78rem; text-transform:uppercase; letter-spacing:.05em; font-weight:600; }
      .ph-table tbody tr:hover { background: hsl(var(--accent)); }
      .ph-table tbody tr { border-bottom:1px solid hsl(var(--border)); }
      @media(max-width:640px){
        .ph-stats-grid { grid-template-columns: 1fr 1fr !important; }
        .ph-table thead th:nth-child(4),
        .ph-table tbody td:nth-child(4) { display:none; }
      }
    </style>

    <div style="padding: 1.5rem 1rem;">
      <h1 style="font-size:1.5rem; font-weight:700; margin-bottom:0.25rem;">💰 Profit History</h1>
      <p class="text-muted" style="margin-bottom:1.5rem;">All admin profit adjustments credited or debited on your account</p>

      <!-- Summary cards -->
      <div class="ph-stats-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:1.5rem;">
        <div class="ph-card ph-stat">
          <span class="ph-stat-label">Current Profit</span>
          <span class="ph-stat-value" style="color:hsl(var(--chart-2));">${fmt(currentProfit)}</span>
        </div>
        <div class="ph-card ph-stat">
          <span class="ph-stat-label">Total Credited</span>
          <span class="ph-stat-value" style="color:hsl(var(--chart-2));">+${fmt(totalAdded)}</span>
        </div>
        <div class="ph-card ph-stat">
          <span class="ph-stat-label">Total Debited</span>
          <span class="ph-stat-value" style="color:hsl(var(--destructive));">-${fmt(totalDeducted)}</span>
        </div>
      </div>

      <!-- History table -->
      <div class="ph-card" style="overflow-x:auto;">
        <h2 style="font-size:1rem; font-weight:600; margin-bottom:1rem;">Adjustment Log</h2>
        <table class="ph-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Amount</th>
              <th>Note</th>
              <th>Before → After</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ==================== DASHBOARD PAGE ====================
function renderDashboardPage() {
  const user = getUserData();

  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Dashboard</h1>
      <p class="text-muted">Welcome back, ${user.firstName} ${user.lastName}!</p>
    </div>

    <!-- Ticker Tape -->
    <div class="card" style="padding: 0; margin-bottom: 1.5rem;">
      <div id="tradingview-ticker-tape"></div>
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="card stat-card">
        <div class="stat-label">Total Balance</div>
        <div class="stat-value">${money(user.balance)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Total Profit</div>
        <div class="stat-value" style="color: hsl(var(--chart-2));">${money(user.profit)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Active Trades</div>
        <div class="stat-value">${user.transactions.filter(t => t.status === 'active').length}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Referral Bonus</div>
        <div class="stat-value">${money(user.referalBonus)}</div>
      </div>
    </div>

    <!-- ✅ TradingView Widgets -->
    <div class="tv-widgets-container" style="
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-top: 1.5rem;
    ">
      <div class="card tv-widget" id="tv-widget-1" style="
        flex: 1 1 48%;
        min-width: 300px;
      "></div>
      <div class="card tv-widget" id="tv-widget-2" style="
        flex: 1 1 48%;
        min-width: 300px;
      "></div>
    </div>

    <style>
      @media (max-width: 768px) {
        .tv-widgets-container {
          flex-direction: column;
        }
        .tv-widget {
          width: 100% !important;
        }
      }
    </style>
  `;

  const content = document.getElementById('content');
  content.innerHTML = html;

  // ✅ Delay widget loading slightly to ensure DOM exists
  setTimeout(() => {
    loadTickerTapeWidget();
    loadTradingViewWidget2("tv-widget-1", "NASDAQ:TSLA");
    loadTradingViewWidget2("tv-widget-2", "NASDAQ:NVDA");
  }, 150);
}

function loadTickerTapeWidget() {
  const container = document.getElementById('tradingview-ticker-tape');
  if (!container) return console.warn('Ticker tape container not found');

  container.innerHTML = '';

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
  script.async = true;

  const config = {
    symbols: [
      { proName: "FOREXCOM:SPXUSD", title: "S&P 500 Index" },
      { proName: "FOREXCOM:NSXUSD", title: "US 100 Cash CFD" },
      { proName: "FX_IDC:EURUSD", title: "EUR to USD" },
      { proName: "NASDAQ:TSLA", title: "Tesla" },
      { proName: "NASDAQ:NVDA", title: "NVIDIA" },
      { proName: "NASDAQ:AMZN", title: "Amazon" },
      { proName: "NASDAQ:META", title: "Meta" }
    ],
    colorTheme: document.documentElement.classList.contains('dark') ? "dark" : "light",
    locale: "en",
    isTransparent: true,
    showSymbolLogo: true,
    displayMode: "adaptive"
  };

  script.innerHTML = JSON.stringify(config);
  container.appendChild(script);
}

function loadTradingViewWidget2(containerId, symbol) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = ''; // clear before appending new one

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
  script.async = true;

  const config = {
    symbol: symbol,
    width: "100%",
    height: 350,
    locale: "en",
    dateRange: "12M",
    colorTheme: document.documentElement.classList.contains('dark') ? "dark" : "light",
    trendLineColor: "#37a2eb",
    underLineColor: "rgba(55, 162, 235, 0.1)",
    isTransparent: true
  };

  script.innerHTML = JSON.stringify(config);
  container.appendChild(script);
}

 function renderTradePage() {
  const content = document.getElementById('content');
  const user = getUserData(); // however you retrieve user info
  console.log(user);

  content.innerHTML = `
    <div class="trade-page">
     <div class="trade-intro">
  <h3>Smart Trading Dashboard</h3>
  <p>
    Trade crypto, forex, and stocks with real-time insights. 
    Use the charts below to analyze market movements before placing your trades.
  </p>
</div>


      <!-- Top TradingView Chart -->
      <div id="tradingview_top" class="tradingview-widget"></div>

      <!-- Trading Card -->
      <div class="trade-container">
        <div class="trading-card">
          <div class="header">
            <div class="balance">Balance: <span id="balance2">${money(user.balance)}</span></div>
            <div class="live">LIVE TRADING</div>
          </div>

          <form id="tradeForm">
            <label>Asset Type</label>
            <select id="assetType" required>
              <option value="">Select Asset Type</option>
              <option value="crypto">Crypto</option>
              <option value="forex">Forex</option>
              <option value="stock">Stock</option>
            </select>

            <label>Asset</label>
            <select id="assetName" required>
              <option value="">Select Asset</option>
            </select>

            <label>Leverage</label>
            <div class="leverage-buttons" id="leverageButtons"></div>
            <input type="range" id="leverageRange" min="1" max="100" step="1" value="1">

            <label>Duration</label>
            <select id="duration" required>
              <option value="">Select Duration</option>
              <option value="1">1 Minute</option>
              <option value="2">2 Minutes</option>
              <option value="5">5 Minutes</option>
              <option value="15">15 Minutes</option>
              <option value="60">1 Hour</option>
               <option value="1440">1 Day</option>
  <option value="2880">2 Days</option>
  <option value="4320">3 Days</option>
  <option value="5760">4 Days</option>
  <option value="7200">5 Days</option>
  <option value="8640">6 Days</option>
  <option value="10080">7 Days</option>
            </select>

            <label>Amount</label>
            <input type="text" inputmode="decimal" id="amount" placeholder="Enter trade amount (${currencySymbol()})" required>

            <div class="tp-sl">
              <div>
                <label>Take Profit</label>
                <input type="number" id="takeProfit" required>
              </div>
              <div>
                <label>Stop Loss</label>
                <input type="number" id="stopLoss" required>
              </div>
            </div>

            <div class="actions">
              <button type="button" id="buyBtn" class="buy" disabled>Buy</button>
              <button type="button" id="sellBtn" class="sell" disabled>Sell</button>
            </div>
             <!-- History Button -->
        <div class="history-section">
          <button id="viewHistoryBtn" class="history-btn">
            <i class="fas fa-history"></i> View Trade History
          </button>
        </div>
      </div>
          </form>
        </div>
      </div>

      <!-- Bottom TradingView Chart -->
      <div id="tradingview_bottom" class="tradingview-widget"></div>

     
    </div>
  `;

  // ✅ Initialize TradingView
  function initializeTradingView(symbol = "BTCUSDT") {
    const topWidget = document.getElementById("tradingview_top");
    const bottomWidget = document.getElementById("tradingview_bottom");
    topWidget.innerHTML = "";
    bottomWidget.innerHTML = "";

    new TradingView.widget({
      autosize: true,
      symbol: symbol,
      interval: "30",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      toolbar_bg: "#f1f3f6",
      enable_publishing: false,
      container_id: "tradingview_top"
    });

    new TradingView.widget({
      autosize: true,
      symbol: symbol,
      interval: "60",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      enable_publishing: false,
      container_id: "tradingview_bottom"
    });
  }

  // Load initial charts
  initializeTradingView();

  // ------------------------------
  // Initialize Assets & Leverage
  // ------------------------------
  const assets = {
    crypto: ["BTC/USDT","ETH/USDT","XRP/USDT","ADA/USDT","DOGE/USDT","SOL/USDT","DOT/USDT","LTC/USDT","BNB/USDT","MATIC/USDT"],
    forex: ["EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","USD/CHF","NZD/USD","EUR/GBP","EUR/JPY","GBP/JPY"],
    stock: ["AAPL","TSLA","GOOGL","AMZN","MSFT","NFLX","META","NVDA","BABA","AMD"]
  };

  const assetTypeEl = document.getElementById("assetType");
  const assetNameEl = document.getElementById("assetName");
  const leverageButtonsEl = document.getElementById("leverageButtons");
  const leverageRangeEl = document.getElementById("leverageRange");
  const form = document.getElementById("tradeForm");
  const buyBtn = document.getElementById("buyBtn");
  const sellBtn = document.getElementById("sellBtn");

  // Populate leverage buttons
  const LEVERAGES = [...Array(10).keys()].map(i => i + 1).concat([20,30,40,50,60,70,80,90,100]);
  LEVERAGES.forEach(lv => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${lv}x`;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".leverage-buttons button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      leverageRangeEl.value = lv;
    });
    leverageButtonsEl.appendChild(btn);
  });

  leverageRangeEl.addEventListener("input", e => {
    document.querySelectorAll(".leverage-buttons button").forEach(b => b.classList.remove("active"));
    const closest = LEVERAGES.reduce((prev, curr) => Math.abs(curr - e.target.value) < Math.abs(prev - e.target.value) ? curr : prev);
    const activeBtn = Array.from(leverageButtonsEl.children).find(b => b.textContent === `${closest}x`);
    if (activeBtn) activeBtn.classList.add("active");
  });

  // Populate assets dropdown
  assetTypeEl.addEventListener("change", () => {
    assetNameEl.innerHTML = '<option value="">Select Asset</option>';
    if (assets[assetTypeEl.value]) {
      assets[assetTypeEl.value].forEach(a => {
        const option = document.createElement("option");
        option.value = a;
        option.textContent = a;
        assetNameEl.appendChild(option);
      });
    }
  });

  // ✅ Auto-update chart when asset changes
  assetNameEl.addEventListener("change", () => {
    const asset = assetNameEl.value;
    if (!asset) return;
    const formatted = asset.replace("/", ""); // e.g. BTC/USDT → BTCUSDT
    initializeTradingView(formatted);
  });

  // Enable buttons when form is filled
  form.addEventListener("input", () => {
    const allFilled = [...form.elements].every(el => {
      if (el.tagName === "SELECT" || el.tagName === "INPUT") return el.value.trim() !== "";
      return true;
    });
    buyBtn.disabled = !allFilled;
    sellBtn.disabled = !allFilled;
  });

  // ------------------------------
  // Backend Trade Functions
  // ------------------------------
  const email = user.email;

  async function getPartUserData() {
    try {
      const data = await $.ajax({
        type: "GET",
        url: `https://vantage-render.onrender.com/users/${email}`,
        dataType: "json",
        timeout: 30000
      });
      $("#balance2").text(money(data.data.balance));
      return data.data;
    } catch (err) {
      console.error(err);
    }
  }

  async function commandTrade(tradeId, state) {
    try {
      const res = await $.ajax({
        type: "PUT",
        url: `https://vantage-render.onrender.com/transactions/trades/${tradeId}/commandTrade`,
        data: JSON.stringify({ command: state }),
        contentType: "application/json",
        dataType: "json"
      });
      return res;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  async function depositFnc(trade) {
    try {
      const user_Id = user._id;
      const data = await $.ajax({
        type: "POST",
        url: `https://vantage-render.onrender.com/transactions/${user_Id}/userdeposit`,
        dataType: "json",
        data: trade,
        timeout: 30000
      });
      const tradeId = data.tradeId;
      const state = "true";
      await commandTrade(tradeId, state);
      Swal.fire({
        icon: 'success',
        title: `Trade Placed!`,
        text: `${trade.assetName} | ${money(trade.amount)} @ ${trade.leverage}`,
        confirmButtonColor: '#f0b90b'
      });
      setTimeout(() => renderTradeHistoryPage(), 2000);
    } catch (err) {
      console.error(err);
      alert("Failed to place trade");
    }
  }

  async function placeTrade(action) {
    const trade = {
      assetType: assetTypeEl.value,
      assetName: assetNameEl.value,
      leverage: leverageRangeEl.value + "x",
      duration: document.getElementById("duration").value,
      amount: toUSD(document.getElementById("amount").value),
      takeProfit: document.getElementById("takeProfit").value,
      stopLoss: document.getElementById("stopLoss").value,
      action
    };
    await depositFnc(trade);
  }

  buyBtn.addEventListener("click", () => placeTrade("BUY"));
  sellBtn.addEventListener("click", () => placeTrade("SELL"));
  document.getElementById("viewHistoryBtn").addEventListener("click", () => renderTradeHistoryPage());

  // Fetch latest user balance
  getPartUserData();
}


function renderTradeHistoryPage() {
  const content = document.getElementById('content');

  content.innerHTML = `
    <div class="trade-history-page">
<!-- Top Section: Write-up + Widget -->
<div class="trade-history-top">
  <div class="writeup">
    <h1>Trade History Overview 📊</h1>
    <p>
      Review all your past trades with detailed performance metrics.
      Track profits, losses, leverage used, and trade durations to improve your trading strategy.
    </p>
    <button id="historyRefreshBtn" class="btn btn-primary">Refresh Trades</button>
  </div>
  
  <div class="widget-placeholder">
    <h3>Portfolio Summary</h3>
    <p id="tradeSummaryWidget">Loading...</p>
  </div>
</div>

      </div>

      <!-- Loader -->
      <div id="loader" class="loader" style="display:none; text-align:center; margin:1rem 0;">
        <div class="spinner" style="border:4px solid #333; border-top:4px solid #f0b90b; border-radius:50%; width:30px; height:30px; animation:spin 1s linear infinite; margin:auto;"></div>
        <p style="color:#aaa; margin-top:0.5rem;">Loading...</p>
      </div>

      <!-- Trade Table -->
      <div class="table-container" style="overflow-x:auto; margin-bottom:2rem;">
        <table class="trade-table ">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Amount</th>
              <th>Leverage</th>
              <th>Duration</th>
              <th>Countdown</th>
              <th>Profit / Loss</th>
              <th>Action</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="tradeTable"></tbody>
        </table>
      </div>

      <!-- Analytics / Graphs -->
      <div class="trade-analytics" style="margin-top:2rem;">
        <div class="trade-history-top">
  <div class="writeup">
   

    </div>
    </div>
       
      </div>
    </div>

    <style>
      @keyframes spin { 100% { transform: rotate(360deg); } }
      .trade-table.dark-theme { width:100%; border-collapse:collapse; background:#1e1e2f; color:#ddd; border-radius:0.5rem; overflow:hidden; }
      .trade-table.dark-theme thead { background:#2c2c3c; color:#f0b90b; }
      .trade-table.dark-theme tbody tr:nth-child(even) { background:#2a2a3a; }
      .trade-table.dark-theme tbody tr:hover { background:#33334d; }
      .trade-table td, .trade-table th { padding:0.75rem; }
      .won { color:#4caf50; font-weight:600; }
      .lost { color:#f44336; font-weight:600; }
    </style>
  `;

  const BASE_URL = "https://vantage-render.onrender.com";
  const tradeTable = document.getElementById("tradeTable");
  const loader = document.getElementById("loader");
  const summaryWidget = document.getElementById("tradeSummaryWidget");
  const historyRefreshBtn = document.getElementById("historyRefreshBtn");

  const timers = new Map();

//   // ------------------ Chart.js instances ------------------
//   let profitLossChartInstance = null;
//   let tradesByAssetChartInstance = null;
//   let leverageUsageChartInstance = null;
// const chartOptions = (textColor) => ({
//   responsive: true,
//   plugins: {
//     legend: {
//       display: true,
//       labels: {
//         color: `hsl(${textColor})`, // text color from theme
//         font: { size: 13, family: 'Inter, sans-serif', weight: '600' }
//       }
//     },
//     tooltip: {
//       bodyColor: `hsl(${textColor})`,
//       titleColor: `hsl(${textColor})`,
//       backgroundColor: 'rgba(0,0,0,0.7)',
//       titleFont: { weight: '700' }
//     }
//   },
//   scales: {
//     x: { ticks: { color: `hsl(${textColor})` }, grid: { color: 'rgba(255,255,255,0.1)' } },
//     y: { ticks: { color: `hsl(${textColor})` }, grid: { color: 'rgba(255,255,255,0.1)' } },
//   }
// });

// function generateCharts(trades) {
//   // Extract colors from CSS variables
//   const styles = getComputedStyle(document.documentElement);
//   const colors = {
//     text: styles.getPropertyValue('--foreground').trim(),
//     grid: styles.getPropertyValue('--border').trim(),
//     profit: styles.getPropertyValue('--chart-1').trim(),
//     asset: styles.getPropertyValue('--chart-2').trim(),
//     leverage: styles.getPropertyValue('--chart-3').trim(),
//     leverage2: styles.getPropertyValue('--chart-4').trim(),
//     background: styles.getPropertyValue('--card').trim(),
//   };

//   const labels = trades.map(t => t.assetName ?? "Unknown");
//   const profitData = trades.map(t => Number(t.profit || 0));

//   const assetsCount = {};
//   const leverageCount = {};
//   trades.forEach(t => {
//     assetsCount[t.assetName] = (assetsCount[t.assetName] || 0) + 1;
//     leverageCount[t.leverage] = (leverageCount[t.leverage] || 0) + 1;
//   });

//   // Destroy previous charts
//   if (window.profitLossChartInstance) window.profitLossChartInstance.destroy();
//   if (window.tradesByAssetChartInstance) window.tradesByAssetChartInstance.destroy();
//   if (window.leverageUsageChartInstance) window.leverageUsageChartInstance.destroy();

//   // Profit/Loss Line Chart
//   const ctxProfit = document.getElementById('profitLossChart').getContext('2d');
//   window.profitLossChartInstance = new Chart(ctxProfit, {
//     type: 'line',
//     data: {
//       labels,
//       datasets: [{
//         label: 'Profit / Loss',
//         data: profitData,
//         borderColor: `hsl(${colors.profit})`,
//         backgroundColor: `hsla(${colors.profit},0.2)`,
//         tension: 0.3,
//         fill: true,
//         pointRadius: 3,
//         pointBackgroundColor: `hsl(${colors.profit})`,
//       }]
//     },
//     options: {
//       responsive: true,
//       plugins: {
//         legend: { labels: { color: `hsl(${colors.text})` } },
//         tooltip: { mode: 'index', intersect: false }
//       },
//       scales: {
//         x: { ticks: { color: `hsl(${colors.text})` }, grid: { color: `hsla(${colors.grid},0.2)` } },
//         y: { ticks: { color: `hsl(${colors.text})` }, grid: { color: `hsla(${colors.grid},0.2)` } },
//       }
//     }
//   });

//   // Trades by Asset Pie Chart
//   const ctxAsset = document.getElementById('tradesByAssetChart').getContext('2d');
//   window.tradesByAssetChartInstance = new Chart(ctxAsset, {
//     type: 'pie',
//     data: {
//       labels: Object.keys(assetsCount),
//       datasets: [{
//         label: 'Trades by Asset',
//         data: Object.values(assetsCount),
//         backgroundColor: Object.keys(assetsCount).map((_, i) => `hsl(${(i*60)%360}, 70%, 50%)`),
//         borderColor: `hsl(${colors.background})`,
//         borderWidth: 1
//       }]
//     },
//     options: {
//       responsive: true,
//       plugins: {
//         legend: { labels: { color: `hsl(${colors.text})` } },
//         tooltip: { mode: 'nearest' }
//       }
//     }
//   });

//   // Leverage Usage Bar Chart
//   const ctxLeverage = document.getElementById('leverageUsageChart').getContext('2d');
//   window.leverageUsageChartInstance = new Chart(ctxLeverage, {
//     type: 'bar',
//     data: {
//       labels: Object.keys(leverageCount),
//       datasets: [{
//         label: 'Leverage Usage',
//         data: Object.values(leverageCount),
//         backgroundColor: Object.keys(leverageCount).map((_, i) => `hsl(${i%2 === 0 ? colors.leverage : colors.leverage2})`)
//       }]
//     },
//     options: {
//       responsive: true,
//       plugins: {
//         legend: { display: false },
//         tooltip: { mode: 'nearest' }
//       },
//       scales: {
//         y: { beginAtZero: true, ticks: { color: `hsl(${colors.text})` }, grid: { color: `hsla(${colors.grid},0.2)` } },
//         x: { ticks: { color: `hsl(${colors.text})` }, grid: { color: `hsla(${colors.grid},0.2)` } }
//       }
//     }
//   });
// }


  // ------------------ Helpers ------------------
  function parseDuration(duration) {
    if (!duration) return 0;
    if (typeof duration === "number") return duration*60;
    if (!isNaN(duration)) return Number(duration)*60;
    const match = /^(\d+)([smhd])?$/i.exec(String(duration).trim());
    if (!match) return 0;
    const value = parseInt(match[1],10);
    const unit = (match[2]||"m").toLowerCase();
    switch(unit){
      case "s": return value;
      case "m": return value*60;
      case "h": return value*3600;
      case "d": return value*86400;
      default: return 0;
    }
  }

  function formatTime(totalSeconds) {
    const sec = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(sec/3600);
    const m = Math.floor((sec%3600)/60);
    const s = sec%60;
    const pad = n=>String(n).padStart(2,"0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  async function fetchTradeFromBackend(tradeId){
    try{
      const response = await $.ajax({type:"GET", url:`${BASE_URL}/transactions/trades/${tradeId}`, dataType:"json", timeout:30000});
      if(response && response.success && response.trade) return response.trade;
      console.error("No trade object returned:", response); return null
    } catch(err){ console.error("Error fetching trade:", err); return null; }
  }

  function updateResultUI(trade, profitLossEl, actionEl, statusEl){
    if(!trade){
      profitLossEl.textContent="--"; actionEl.textContent="Error"; statusEl.textContent="FAILED"; return;
    }
    const profit=Number(trade.profit||0);
    const amount=Number(trade.tradeAmount||0);
    if(profit>0){
      profitLossEl.textContent=`+${money(profit)}`; profitLossEl.className="won";
      actionEl.textContent="Won"; actionEl.className="won";
    } else{
      profitLossEl.textContent=`-${money(amount)}`; profitLossEl.className="lost";
      actionEl.textContent="Lost"; actionEl.className="lost";
    }
    statusEl.textContent="COMPLETED";
  }

  function renderTrades(trades){
    timers.forEach(t=>clearInterval(t)); timers.clear();
    tradeTable.innerHTML="";

    trades.forEach(trade=>{
      const id=trade._id;
      const row=document.createElement("tr");
      row.innerHTML=`
        <td>${trade.assetName??"-"}</td>
        <td>${money(trade.tradeAmount)}</td>
        <td>${trade.leverage??"-"}</td>
        <td>${trade.duration??"-"}</td>
        <td id="countdown-${id}">--:--:--</td>
        <td id="profitLoss-${id}">-</td>
        <td id="action-${id}">${trade.command==="true"?"Running":"Pending"}</td>
        <td id="status-${id}">${trade.status??"-"}</td>
      `;
      tradeTable.appendChild(row);

      const countdownEl=document.getElementById(`countdown-${id}`);
      const profitLossEl=document.getElementById(`profitLoss-${id}`);
      const actionEl=document.getElementById(`action-${id}`);
      const statusEl=document.getElementById(`status-${id}`);

      if((trade.status||"").toUpperCase()==="COMPLETED"){
        countdownEl.textContent="00:00:00";
        updateResultUI(trade,profitLossEl,actionEl,statusEl);
        return;
      }

      const statusUpper=(trade.status||"").toUpperCase();
      const isActive=statusUpper==="ACTIVE"||statusUpper==="RUNNING"||trade.command==="true";
      if(!isActive){ countdownEl.textContent="--:--:--"; return; }

      const startMs=trade.startTime?Date.parse(trade.startTime):NaN;
      if(!startMs||Number.isNaN(startMs)){ countdownEl.textContent="Waiting…"; statusEl.textContent=trade.status||"PENDING"; return; }

      const durSec=parseDuration(trade.duration);
      if(!durSec){ countdownEl.textContent="—"; return; }

      const endMs=startMs+durSec*1000;

      if(timers.has(id)){ clearInterval(timers.get(id)); timers.delete(id); }

      const tick=async ()=>{
        const now=Date.now();
        const left=Math.max(0,Math.floor((endMs-now)/1000));
        countdownEl.textContent=formatTime(left);
        actionEl.textContent=trade.command==="true"?"Running":actionEl.textContent;
        statusEl.textContent=statusUpper||"ACTIVE";

        if(left<=0){
          clearInterval(timers.get(id)); timers.delete(id);
          countdownEl.textContent="00:00:00"; statusEl.textContent="Fetching Result...";
          try{
            loader.style.display="flex";
            const refreshed=await fetchTradeFromBackend(id);
            if(refreshed){ updateResultUI(refreshed,profitLossEl,actionEl,statusEl); }
            else{ statusEl.textContent="Error fetching result"; }
          } catch(err){ console.error(err); statusEl.textContent="Error fetching result"; }
          finally{ loader.style.display="none"; }
        }
      };

      tick(); timers.set(id,setInterval(tick,1000));
    });

    // Update summary widget
    const totalTrades=trades.length;
    const totalProfit=trades.reduce((sum,t)=>sum+Number(t.profit||0),0);
    summaryWidget.textContent=`Total Trades: ${totalTrades} | Total Profit/Loss: ${money(totalProfit)}`;

    // Generate charts
    // generateCharts(trades);
  }

  async function loadTrades(){
    try{
      loader.style.display="flex";
      const parsedUser=localStorage.getItem("userData");
      if(!parsedUser){ console.warn("No user in localStorage"); loader.style.display="none"; return []; }

      const userFromLS=JSON.parse(parsedUser);
      const email=userFromLS.email;

      const response=await $.ajax({ type:"GET", url:`${BASE_URL}/users/${email}`, dataType:"json", timeout:30000 });
      if(!response||!response.data) throw new Error("Invalid response from server");

      localStorage.setItem("userData",JSON.stringify(response.data));
      const trades=response.data.planHistory||response.data.trades||[];
      renderTrades(trades);
      return trades;
    } catch(error){
      console.error("Error loading trades:",error);
      Swal.fire({ icon:"error", title:"Failed to load trades", text:"Please check your connection or try again later.", confirmButtonColor:"#f0b90b" });
      return [];
    } finally{ loader.style.display="none"; }
  }

  // Initial load
  loadTrades();
  setInterval(loadTrades,60*1000);

  // Refresh button
  historyRefreshBtn.addEventListener("click", ()=>{ loadTrades(); });
}

async function handlePurchasePlan(planId) {
  const amountInput = document.getElementById(`amount-${planId}`);
  const amount = toUSD(amountInput.value);

  if (!amount || amount <= 0) {
    Swal.fire({ icon: 'warning', title: 'Invalid Amount', text: 'Please enter a valid investment amount', confirmButtonText: 'OK' });
    return;
  }

  // Call purchase function
  const result = await purchaseInvestmentPlan(planId, amount);

  if (!result.success) {
    Swal.fire({
      icon: 'error',
      title: 'Investment Failed',
      text: result.error || 'Something went wrong',
      confirmButtonText: 'OK'
    });
  }
}

function renderAdminPage() {
  const user = getUserData();
  const plans = getInvestmentPlans();
  const plan = user.plan || [];
  
  // Calculate statistics
  const totalUsers = 1; // We only have one user in localStorage
  const totalInvested = plan.filter(inv => inv.status === 'active').reduce((sum, inv) => sum + inv.amount, 0);
  const totalProfitPaid = plan.reduce((sum, inv) => sum + inv.totalProfit, 0);
  const activeInvestmentCount = plan.filter(inv => inv.status === 'active').length;
  
  const plansTableHTML = plans.map((plan, index) => `
    <tr>
      <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${index + 1}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="width: 8px; height: 8px; border-radius: 50%; background-color: ${plan.color};"></div>
          <strong>${plan.name}</strong>
        </div>
      </td>
      <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">$${plan.minInvestment} - $${plan.maxInvestment.toLocaleString()}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${(plan.dailyProfitRate * 100).toFixed(2)}%</td>
       <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${plan.monthly != null ? (plan.monthly * 100).toFixed(2) + "%" : "—"}</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${plan.durationn} hours</td>
      <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">
        <button class="btn" style="background-color: hsl(var(--destructive)); color: hsl(var(--destructive-foreground)); padding: 0.25rem 0.75rem; font-size: 0.875rem;" onclick="handleDeletePlan('${plan.id}')">Delete</button>
      </td>
    </tr>
  `).join('');
  
  const investmentsTableHTML = plan.length > 0 ? plan.map((inv, index) => {
    const daysRemaining = inv.duration - inv.daysElapsed;
    const progress = (inv.daysElapsed / inv.duration) * 100;
    return `
      <tr>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${index + 1}</td>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${inv.planName}</td>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">$${inv.amount.toFixed(2)}</td>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${new Date(inv.startDate).toLocaleDateString()}</td>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">${inv.daysElapsed} / ${inv.duration}</td>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">
          <div style="width: 100%; background-color: hsl(var(--muted)); border-radius: 9999px; height: 6px;">
            <div style="width: ${progress}%; background-color: hsl(var(--chart-2)); height: 100%; border-radius: 9999px;"></div>
          </div>
        </td>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border)); color: hsl(var(--chart-2));">$${inv.totalProfit.toFixed(2)}</td>
        <td style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border));">
          <span class="badge" style="background-color: ${inv.status === 'active' ? 'hsl(var(--chart-2))' : 'hsl(var(--muted))'}; color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">${inv.status}</span>
        </td>
      </tr>
    `;
  }).join('') : '<tr><td colspan="8" style="padding: 2rem; text-align: center; color: hsl(var(--muted-foreground));">No active investments</td></tr>';
  
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Admin Panel 🔒</h1>
      <p class="text-muted">Manage investment plans and monitor platform activity</p>
    </div>
    
    <div class="stats-grid" style="margin-bottom: 1.5rem;">
      <div class="card stat-card">
        <div class="stat-label">Total Users</div>
        <div class="stat-value">${totalUsers}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Active Investments</div>
        <div class="stat-value">${activeInvestmentCount}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Total Invested</div>
        <div class="stat-value">$${totalInvested.toFixed(2)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Total Profit Paid</div>
        <div class="stat-value" style="color: hsl(var(--chart-2));">$${totalProfitPaid.toFixed(2)}</div>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h2 style="font-size: 1.125rem; font-weight: 600;">Quick Actions</h2>
      </div>
      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button class="btn btn-primary" onclick="handleProcessProfits()">Process Daily Profits</button>
        <button class="btn" style="background-color: hsl(var(--secondary)); color: hsl(var(--secondary-foreground));" onclick="handleAddPlan()">Add New Plan</button>
        <button class="btn" style="background-color: hsl(var(--accent)); color: hsl(var(--accent-foreground));" onclick="handleViewLogs()">View API Logs</button>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: 1.5rem; padding: 1.5rem;">
      <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Investment Plans Management</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid hsl(var(--border));">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">#</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Plan Name</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Investment Range</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Daily Rate</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Monthly</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Duration</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${plansTableHTML}
          </tbody>
        </table>
      </div>
    </div>
    
    <div class="card" style="padding: 1.5rem;">
      <h2 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">All Active Investments</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid hsl(var(--border));">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">#</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Plan</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Amount</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Start Date</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Days</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Progress</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Profit</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${investmentsTableHTML}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  content.innerHTML = html;
}

// Admin Functions
function handleProcessProfits() {
  const totalProfit = processDailyProfits();
  if (totalProfit > 0) {
    Swal.fire({ 
      icon: 'success', 
      title: 'Profits Processed!', 
      html: `Total profit distributed: $${totalProfit.toFixed(2)}<br>User balances have been updated.`,
      confirmButtonText: 'OK' 
    }).then(() => {
      renderAdminPage();
    });
  } else {
    Swal.fire({ icon: 'info', title: 'No Profits to Process', text: 'All investments are up to date.', confirmButtonText: 'OK' });
  }
}

function handleAddPlan() {
  Swal.fire({
    title: 'Add New Investment Plan',
    html: `
      <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
        <input id="plan-name" class="swal2-input" placeholder="Plan Name" style="margin: 0;">
        <input id="plan-min" type="number" class="swal2-input" placeholder="Minimum Investment" style="margin: 0;">
        <input id="plan-max" type="number" class="swal2-input" placeholder="Maximum Investment" style="margin: 0;">
        <input id="plan-rate" type="number" step="0.001" class="swal2-input" placeholder="Daily Rate (e.g. 0.02 for 2%)" style="margin: 0;">
        <input id="plan-color" class="swal2-input" placeholder="Color (e.g. hsl(30, 60%, 50%))" style="margin: 0;">
        <textarea id="plan-desc" class="swal2-textarea" placeholder="Description" style="margin: 0;"></textarea>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Add Plan',
    preConfirm: () => {
      const name = document.getElementById('plan-name').value;
      const min = parseFloat(document.getElementById('plan-min').value);
      const max = parseFloat(document.getElementById('plan-max').value);
      const rate = parseFloat(document.getElementById('plan-rate').value);
      const color = document.getElementById('plan-color').value;
      const desc = document.getElementById('plan-desc').value;
      
      if (!name || !min || !max || !rate || !color || !desc) {
        Swal.showValidationMessage('Please fill all fields');
        return false;
      }
      
      return { name, min, max, rate, color, desc };
    }
  }).then((result) => {
    if (result.isConfirmed) {
      const plans = getInvestmentPlans();
      const newPlan = {
        id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
        name: result.value.name,
        minInvestment: result.value.min,
        maxInvestment: result.value.max,
        dailyProfitRate: result.value.rate,
        duration: 90,
        description: result.value.desc,
        color: result.value.color
      };
      plans.push(newPlan);
      updateInvestmentPlans(plans);
      Swal.fire({ icon: 'success', title: 'Plan Added!', text: 'The new investment plan has been created.', confirmButtonText: 'OK' }).then(() => {
        renderAdminPage();
      });
    }
  });
}

function handleDeletePlan(planId) {
  Swal.fire({
    title: 'Delete Plan?',
    text: 'This will permanently delete the investment plan. Existing investments will not be affected.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, delete it',
    cancelButtonText: 'Cancel'
  }).then((result) => {
    if (result.isConfirmed) {
      const plans = getInvestmentPlans();
      const updatedPlans = plans.filter(p => p.id !== planId);
      updateInvestmentPlans(updatedPlans);
      Swal.fire({ icon: 'success', title: 'Deleted!', text: 'The plan has been deleted.', confirmButtonText: 'OK' }).then(() => {
        renderAdminPage();
      });
    }
  });
}

function handleViewLogs() {
  const logs = JSON.parse(localStorage.getItem('apiLogs') || '[]');
  const recentLogs = logs.slice(-20).reverse();
  
  const logsHTML = recentLogs.map(log => `
    <div style="padding: 0.75rem; border-bottom: 1px solid hsl(var(--border)); font-size: 0.875rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
        <strong>${log.action}</strong>
        <span class="text-muted small">${new Date(log.timestamp).toLocaleString()}</span>
      </div>
      <pre style="margin: 0; color: hsl(var(--muted-foreground)); font-size: 0.75rem; white-space: pre-wrap;">${JSON.stringify(log.data, null, 2)}</pre>
    </div>
  `).join('');
  
  Swal.fire({
    title: 'Recent API Logs',
    html: `<div style="max-height: 400px; overflow-y: auto; text-align: left;">${logsHTML}</div>`,
    width: '800px',
    confirmButtonText: 'Close'
  });
}

function renderMarketPage() {
  const html = `
    <div>
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Market</h1>
      <p class="text-muted" style="margin-bottom: 1.5rem;">Trade forex, crypto, stocks, and more with real-time data</p>
    </div>
    
    <div class="card" style="padding: 0; margin-bottom: 1.5rem;">
      <div id="tradingview-widget" style="height: 500px;"></div>
    </div>
    
    <div class="tabs">
      <div class="tabs-list">
        <button class="tab active" data-symbol="FX:EURUSD">EUR/USD</button>
        <button class="tab" data-symbol="FX:GBPUSD">GBP/USD</button>
        <button class="tab" data-symbol="BTCUSD">BTC/USD</button>
        <button class="tab" data-symbol="ETHUSD">ETH/USD</button>
        <button class="tab" data-symbol="NASDAQ:AAPL">AAPL</button>
        <button class="tab" data-symbol="NASDAQ:TSLA">TSLA</button>
      </div>
      <div id="symbolInfo" class="card" style="margin-top: 1rem; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div>
            <h3 id="symbolName" style="font-size: 1.25rem; font-weight: 600;">EUR/USD</h3>
            <p class="text-muted small">Real-time chart data from TradingView</p>
          </div>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          <button class="btn btn-buy" onclick="openQuickTrade('buy')">BUY</button>
          <button class="btn btn-sell" onclick="openQuickTrade('sell')">SELL</button>
        </div>
      </div>
    </div>
  `;
  
  content.innerHTML = html;
  
  // Initialize TradingView Widget with current symbol
  let currentSymbol = 'FX:EURUSD';
  loadTradingViewWidget(currentSymbol);
  
  // Tab switching
  const tabs = content.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentSymbol = tab.dataset.symbol;
      loadTradingViewWidget(currentSymbol);
      document.getElementById('symbolName').textContent = tab.textContent;
      apiLog('MARKET_SYMBOL_CHANGED', { symbol: currentSymbol });
    });
  });
}

function loadTradingViewWidget(symbol) {
  const container = document.getElementById('tradingview-widget');
  container.innerHTML = '';
  
  new TradingView.widget({
    container_id: 'tradingview-widget',
    autosize: true,
    symbol: symbol,
    interval: '15',
    timezone: 'Etc/UTC',
    theme: html.classList.contains('dark') ? 'dark' : 'light',
    style: '1',
    locale: 'en',
    toolbar_bg: '#f1f3f6',
    enable_publishing: false,
    hide_side_toolbar: false,
    allow_symbol_change: true,
    save_image: false,
    studies: [
      'MASimple@tv-basicstudies'
    ]
  });
}

function openQuickTrade(type) {
  const symbolName = document.getElementById('symbolName').textContent;
  const price = 'Market Price'; // TradingView widget shows real-time price
  openTradeModal(symbolName, type.toUpperCase(), price);
}

async function fetchTrader() {
  try {
    const response = await fetch('https://vantage-render.onrender.com/auth/trader/fetch-trader');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const traders = await response.json();
    console.log("Fetched traders:", traders);
    return traders;
  } catch (error) {
    console.error('Error fetching traders:', error);
    return []; // Return empty array if fetch fails
  }
}

async function renderSocialTradingPage() {
  const user = getUserData();
  const displayName = `${user.firstName}${user.lastName}`.toLowerCase();

  // 🔹 Fetch traders dynamically
  const masterTraders = await fetchTrader();

  // If no traders fetched, show fallback
  if (!masterTraders.length) {
    content.innerHTML = `
      <div class="hero-banner">
        <h1 class="hero-title">Welcome, <span class="text-primary">${displayName}</span>!</h1>
        <p style="font-size: 1.125rem;">Social Trading 🔥</p>
      </div>
      <div class="card" style="padding: 1rem; text-align: center;">
        <p>No master traders available at the moment. Please check back later.</p>
      </div>
      <!-- Place this button somewhere on your dashboard -->


    `;
    return;

    // JS: Event listener to load Copy Trading History
document.getElementById("loadCopyHistoryBtn").addEventListener("click", () => {
  renderCopyTradingHistory();
});
  }

  const html = `
    <div class="hero-banner">
      <h1 class="hero-title">Welcome, <span class="text-primary">${displayName}</span>!</h1>
      <p style="font-size: 1.125rem;">Social Trading 🔥</p>
      
    </div>

    ${user.copyTradingActive && user.copyTradingActive.length > 0 ? `
      <div class="card" style="margin-bottom: 1.5rem; background-color: hsl(var(--primary) / 0.1); border-color:#0fef9e;">
        <h3 style="font-weight: 600; margin-bottom: 0.5rem;">Active Copy Trading</h3>
        <p class="text-muted small">You are currently copying ${user.copyTradingActive.length} trader(s)</p>
      </div>
    ` : ''}
<button id="loadCopyHistoryBtn" class="btn btn-primary">
 History <i class="fas fa-arrow-right" style="color:#fff;"></i>

</button>

    <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Master Traders</h2>
    <div class="card-grid">
      ${masterTraders.map(trader => `
        <div class="card trader-card">
          <div class="trader-header">
            <div class="trader-avatar" 
                 style="background-color: hsl(var(--primary) / 0.2); display: flex; align-items: center; justify-content: center; font-weight: 600; color: hsl(var(--primary))">

          <img src=${trader.photo} style="width:50px; height:50px; border-radius:50%;"/>
            </div>
            <div class="trader-info">
              <h3>${trader.name || 'Unnamed Trader'}</h3>
              <span class="badge">${trader.level || 'Standard'}</span>
            </div>
          </div>

          <div class="trader-rating">
            ${Array(5).fill(0).map((_, i) => `
              <svg class="star ${i < (trader.rating || 0) ? '' : 'empty'}" viewBox="0 0 24 24">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 
                                 18.18 21.02 12 17.77 5.82 21.02 
                                 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            `).join('')}
          </div>

          <div class="trader-stats">
            <div>
              <div class="stat-label">Number of trades</div>
              <div class="stat-value">${trader.numberOfTrades || 0}</div>
            </div>
            <div>
              <div class="stat-label">Commission</div>
              <div class="stat-value">${String(trader.commission || 0).replace(/%$/, '')}%</div>
            </div>
          </div>

          <div class="trader-pnl">
            <span style="font-weight: 600;">P&L</span>
            <span class="pnl-value">${trader.pnl || '₦0'}</span>
          </div>

          <button 
  class="btn btn-primary btn-block"
  data-name="${trader.name || 'Unknown'}"
  data-level="${trader.level || 'N/A'}"
  data-rating="${trader.rating || '0'}"
  data-photo="${trader.photo || ' '}"
  data-trades='${JSON.stringify(trader.trades || [])}'
  data-numberoftrades="${trader.numberOfTrades || '0'}"
  data-commission="${trader.commission || '0%'}"
  data-pnl="${trader.pnl || '₦0'}"
  data-profileid="${trader.profileId || 'N/A'}"
  data-accountlevel="${trader.accountLevel || 'Basic'}"
  data-type="${trader.type || 'N/A'}"
  data-history='${JSON.stringify(trader.history || [])}'
  data-followers="${trader.followers || '0'}"
  data-watchers="${trader.watchers || '0'}"
  data-profitabletrade="${trader.profitableTrade || '0%'}"
  onclick="openCopyTradeModal(this)">
  Mirror Trade
</button>

        </div>
      `
    
    ).join('')}
    </div>
  `;

  content.innerHTML = html;

   // JS: Event listener to load Copy Trading History
document.getElementById("loadCopyHistoryBtn").addEventListener("click", () => {
  renderCopyTradingHistory(user.copyTradingActive);
});
}

// function openCopyTradeModal(btn) {
//   // Parse arrays safely
//   const trades = JSON.parse(btn.dataset.trades || "[]");
//   const history = JSON.parse(btn.dataset.history || "[]");

//   // Fill modal fields
//   document.getElementById("name").textContent = btn.dataset.name;
//   document.getElementById("level").textContent = btn.dataset.level;
//   document.getElementById("rating").textContent = btn.dataset.rating;
//   document.getElementById("trades").textContent = trades.length || 0;
//   document.getElementById("commission").textContent = btn.dataset.commission;
//   document.getElementById("pnl").textContent = btn.dataset.pnl;
//   document.getElementById("profileId").textContent = btn.dataset.profileid;
//   document.getElementById("accountLevel").textContent = btn.dataset.accountlevel;
//   document.getElementById("type").textContent = btn.dataset.type;
//   document.getElementById("followers").textContent = btn.dataset.followers;
//   document.getElementById("watchers").textContent = btn.dataset.watchers;
//   document.getElementById("profitableTrade").textContent = btn.dataset.profitabletrade;

//   // If you have a trader photo
//   if (btn.dataset.photo) {
//     document.getElementById("photo").src = btn.dataset.photo;
//   }

//   // If you want to display trade history (optional)
//   const historyList = document.getElementById("historyList");
//   if (historyList) {
//     historyList.innerHTML = history.length
//       ? history.map((h) => `<li>${h}</li>`).join("")
//       : "<li>No history available</li>";
//   }

//   // Show modal
//   document.getElementById("copyTradeModal").classList.add("show");
// }



function renderLiveStreamPage() {
  const user = getUserData();
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Live Stream 📊🔥</h1>
      <p class="text-muted">Watch professional traders in action</p>
    </div>
    <div class="live-stream-container">
      <div class="video-background" style="background: linear-gradient(45deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);"></div>
      <div class="stream-overlay">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
          <polyline points="17 2 12 7 7 2"></polyline>
        </svg>
        <h2>Premium Content</h2>
        <p>${user.amountDeposited}</p>
        <div style="display: flex; gap: 1rem;">
          <button class="btn btn-primary" onclick="Swal.fire({ icon: 'info', title: 'Upgrade Required', text: 'Please contact support to upgrade your account', confirmButtonText: 'OK' })">Contact Support</button>
          <button class="btn" style="background-color: hsl(var(--secondary)); color: hsl(var(--secondary-foreground));" onclick="loadPage('fund-account')">Fund Account</button>
        </div>
      </div>
    </div>
    <div style="margin-top: 2rem;">
      <h3 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem;">Upcoming Sessions</h3>
      <div class="card-grid">
        <div class="card" style="padding: 1.25rem;">
          <h4 style="font-weight: 600; margin-bottom: 0.5rem;">Forex Day Trading</h4>
          <p class="text-muted small" style="margin-bottom: 0.75rem;">Master: Ali G</p>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="text-muted small">Tomorrow, 9:00 AM</span>
            <span class="badge">Premium</span>
          </div>
        </div>
        <div class="card" style="padding: 1.25rem;">
          <h4 style="font-weight: 600; margin-bottom: 0.5rem;">Crypto Swing Trading</h4>
          <p class="text-muted small" style="margin-bottom: 0.75rem;">Master: Sarah Chen</p>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="text-muted small">Tomorrow, 2:00 PM</span>
            <span class="badge">Premium</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  content.innerHTML = html;
}

function renderFundAccountPage() {
  const user = getUserData();
  const html = `
    <div class="hero-banner">
  <h1 class="hero-title">Fund Account 💰</h1>
  <p style="font-size: 1rem; opacity: 0.9;">Current Balance: ${money(user.balance)}</p>
</div>

<div class="card" style="max-width: 42rem;">
  <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem;">Make Deposit</h2>

  <!-- 👇 Wallet Display Area -->
  <div id="walletDisplay" style="display: none; text-align: center; margin-bottom: 1.5rem;">
    <div id="walletQr" aria-label="Wallet QR" style="display: inline-block; width: 140px; height: 140px; padding: 6px; background: #fff; margin-bottom: 1rem; border-radius: 8px; border: 1px solid #eee;"></div>
    <p style="font-size: 0.95rem; word-break: break-all; margin: 0 0 0.75rem 0;">
      <strong id="walletLabel"></strong>: 
      <span id="walletAddress"></span>
    </p>
    <button id="copyAddressBtn" onclick="(function(){
      const addr = document.getElementById('walletAddress').textContent;
      navigator.clipboard.writeText(addr).then(function(){
        const btn = document.getElementById('copyAddressBtn');
        const orig = btn.textContent;
        btn.textContent = '✅ Copied!';
        btn.style.backgroundColor = 'hsl(var(--chart-2))';
        setTimeout(function(){ btn.textContent = orig; btn.style.backgroundColor = ''; }, 2000);
      }).catch(function(){
        const ta = document.createElement('textarea');
        ta.value = addr;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const btn = document.getElementById('copyAddressBtn');
        btn.textContent = '✅ Copied!';
        setTimeout(function(){ btn.textContent = '📋 Copy Address'; }, 2000);
      });
    })()" style="
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 1.1rem;
      border: 1px solid hsl(var(--border));
      border-radius: 6px;
      background: hsl(var(--muted));
      color: hsl(var(--foreground));
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
    ">📋 Copy Address</button>
  </div>

  <!-- 👇 Wire Transfer bank details (shown when "Wire Transfer" is selected) -->
  <div id="wireDisplay" style="display: none; margin-bottom: 1.5rem; padding: 1rem; border: 1px solid hsl(var(--border)); border-radius: 8px; font-size: 0.95rem;"></div>

  <form id="depositForm">
    <div class="form-group">
      <label for="depositWallet">Deposit Channel</label>
      <select id="depositWallet" class="input" required>
        <option value="">Select a Wallet</option>
      </select>
      <p id="depositChannelsNote" class="text-muted small" style="margin: 0.4rem 0 0;">Loading deposit channels…</p>
    </div>

    <div class="form-group">
      <label for="depositAmount">Amount (${currencySymbol()})</label>
      <input type="text" inputmode="decimal" id="depositAmount" class="input" placeholder="Enter Amount (${currencySymbol()})" required>
    </div>

    <button type="submit" class="btn btn-primary btn-block">Submit Deposit Request</button>
  </form>
</div>

${renderDepositHistory(user)}

<div style="text-align: center; margin-top: 2rem; padding-top: 2rem; border-top: 1px solid hsl(var(--border));">
  <p class="text-muted small">COPYRIGHT ©2025 vantagestonk, All rights Reserved</p>
</div>


  `;
  
  content.innerHTML = html;
  
  const walletDisplay = document.getElementById("walletDisplay");
  const walletLabel = document.getElementById("walletLabel");
  const walletAddress = document.getElementById("walletAddress");
  const walletQr = document.getElementById("walletQr");

  // Crypto deposit channels come only from the admin-managed list on the
  // server (GET /settings/wallets) — nothing is hardcoded here.
  const wallets = new Map();
  const depositChannelsNote = document.getElementById("depositChannelsNote");

  // Insert before Wire/Demo so crypto channels stay first whichever loads first.
  function insertDepositOption(select, opt) {
    const anchor = select.querySelector('option[value="wire"], option[value="demo"]');
    select.insertBefore(opt, anchor);
  }

  $.ajax({
    type: "GET",
    url: "https://vantage-render.onrender.com/settings/wallets",
    dataType: "json",
    cache: false,
    timeout: 30000
  }).then(res => {
    const select = document.getElementById("depositWallet");
    const list = res && Array.isArray(res.data) ? res.data : [];
    list.forEach(w => {
      if (!w || typeof w.key !== "string" || typeof w.address !== "string" || wallets.has(w.key)) return;
      wallets.set(w.key, Object.freeze({ label: String(w.label || w.key), address: w.address }));
      const opt = document.createElement("option");
      opt.value = w.key;
      opt.textContent = String(w.label || w.key);
      insertDepositOption(select, opt);
    });
    if (depositChannelsNote) {
      depositChannelsNote.textContent = wallets.size ? "" : "No crypto deposit channels are available right now. Please contact support.";
      depositChannelsNote.style.display = wallets.size ? "none" : "block";
    }
  }).catch(err => {
    console.error("Error loading deposit wallets:", err);
    if (depositChannelsNote) depositChannelsNote.textContent = "Crypto deposit channels are temporarily unavailable. Please try again later or contact support.";
  });

  function renderWalletQr(address) {
    walletQr.innerHTML = "";
    if (typeof QRCode === "function") {
      new QRCode(walletQr, { text: address, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.M });
    } else {
      walletQr.style.display = "none"; // library failed to load — address + copy button still work
    }
  }


  // Demo deposit method — only offered when an admin has switched it on.
  const DEMO_FALLBACK = { title: "Demo Mode", message: "This is a demo deposit method. No real funds are moved." };
  let demoSettings = null;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function showDemoMessage() {
    const title = (demoSettings && demoSettings.title) || DEMO_FALLBACK.title;
    const message = (demoSettings && demoSettings.message) || DEMO_FALLBACK.message;
    Swal.fire({
      icon: 'info',
      title: escapeHtml(title),
      html: escapeHtml(message).replace(/\n/g, '<br>'),
      confirmButtonText: 'OK'
    });
  }

  $.ajax({
    type: "GET",
    url: "https://vantage-render.onrender.com/demo-settings",
    dataType: "json",
    timeout: 30000
  }).then(res => {
    const select = document.getElementById("depositWallet");
    if (!res || !res.data || !res.data.enabled || !select) return;
    demoSettings = res.data;
    const opt = document.createElement("option");
    opt.value = "demo";
    opt.textContent = "Demo";
    select.appendChild(opt);
  }).catch(err => console.error("Error loading demo settings:", err));

  // Wire Transfer deposit method — only offered when an admin has switched it on.
  const wireDisplay = document.getElementById("wireDisplay");

  $.ajax({
    type: "GET",
    url: "https://vantage-render.onrender.com/wire-transfer-settings",
    dataType: "json",
    timeout: 30000
  }).then(res => {
    const select = document.getElementById("depositWallet");
    if (!res || !res.data || !res.data.enabled || !select || !wireDisplay) return;
    const s = res.data;
    const rows = [
      ["Bank Name", s.bankName],
      ["Bank Address", s.bankAddress],
      ["Account Name", s.accountName],
      ["Account Number", s.accountNumber],
      ["Routing / Sort Code", s.routingOrSortCode],
      ["SWIFT / BIC", s.swiftBic],
    ].filter(([, v]) => v);
    wireDisplay.innerHTML =
      rows.map(([k, v]) => `<p style="margin: 0 0 0.4rem; word-break: break-all;"><strong>${k}:</strong> ${escapeHtml(v)}</p>`).join("") +
      (s.referenceNote ? `<p class="text-muted small" style="margin: 0.6rem 0 0;">${escapeHtml(s.referenceNote)}</p>` : "");
    const opt = document.createElement("option");
    opt.value = "wire";
    opt.textContent = "Wire Transfer";
    // keep Demo (if already added) as the last option
    const demoOpt = select.querySelector('option[value="demo"]');
    select.insertBefore(opt, demoOpt);
  }).catch(err => console.error("Error loading wire transfer settings:", err));

  document.getElementById("depositWallet").addEventListener("change", function() {
    const value = this.value;
    wireDisplay.style.display = value === "wire" ? "block" : "none";
    if (value === "wire") {
      walletDisplay.style.display = "none";
      return;
    }
    if (value === "demo") {
      walletDisplay.style.display = "none";
      showDemoMessage();
      return;
    }
    const w = wallets.get(value);
    if (w) {
      walletDisplay.style.display = "block";
      walletLabel.textContent = w.label;
      walletAddress.textContent = w.address;
      renderWalletQr(w.address);
    } else {
      walletDisplay.style.display = "none";
    }
  });
  document.getElementById('depositForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const wallet = document.getElementById('depositWallet').value;
    const amount = toUSD(document.getElementById('depositAmount').value);

    // Demo never creates a real deposit request — just show the message again.
    if (wallet === 'demo') {
      showDemoMessage();
      return;
    }

    if (wallet !== 'wire' && !wallets.has(wallet)) {
      Swal.fire({ icon: 'warning', title: 'Select a Deposit Channel', text: 'Please choose one of the available deposit channels.', confirmButtonText: 'OK' });
      return;
    }

    if (amount < 10) {
      Swal.fire({ icon: 'warning', title: 'Invalid Amount', text: `Minimum deposit amount is ${money(10)}`, confirmButtonText: 'OK' });
      return;
    }

    addTransaction({
      type: 'deposit',
      method: wallet,
      amount: amount,
      status: 'pending'
    });
    
    // Swal.fire({ 
    //   icon: 'success', 
    //   title: 'Deposit Submitted!', 
    //   html: `<strong>Method:</strong> ${wallet}<br><strong>Amount:</strong> $${amount.toFixed(2)}<br><br>Your deposit is being processed.`,
    //   confirmButtonText: 'OK'
    // });
    e.target.reset();
    wireDisplay.style.display = "none";
    walletDisplay.style.display = "none";
  });
}

function renderProfilePage() {
  const user = getUserData();
  const initials = (user.firstName[0] + user.lastName[0]).toUpperCase();
  
  const html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700;">Profile Settings</h1>
      <div class="avatar" style="width: 4rem; height: 4rem; font-size: 1.25rem;">${initials}</div>
    </div>
    <div class="card">
      <p class="text-muted" style="margin-bottom: 1.5rem;">
        We provide innovative strategies and expert insights to secure your future and build a lasting legacy. Your journey to financial greatness begins now!
      </p>
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Personal Data</h2>
      ${user.kyc !== 'Verified' ? `
        <div style="padding: 0.75rem; background-color: hsl(var(--destructive) / 0.1); border: 1px solid hsl(var(--destructive) / 0.2); border-radius: 0.5rem; margin-bottom: 1.5rem;">
          <p style="font-size: 0.875rem; color: hsl(var(--destructive)); font-weight: 500;">KYC ${user.kyc === 'unverified' ? 'Required' : user.kyc} - Please update your profile.</p>
        </div>
      ` : ''}
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem;">
        <div>
          <div class="stat-label">Full Name</div>
          <div class="stat-value">${user.firstName} ${user.lastName}</div>
        </div>
        <div>
          <div class="stat-label">Display Name</div>
          <div class="stat-value">${user.firstName}${user.lastName}</div>
        </div>
        <div>
          <div class="stat-label">Email</div>
          <div class="stat-value">${user.email}</div>
        </div>
        <div>
          <div class="stat-label">Country</div>
          <div class="stat-value">${user.country}</div>
        </div>
        <div>
          <div class="stat-label">KYC Status</div>
          <span class="badge" style="background-color: ${user.kyc === 'Verified' ? 'hsl(var(--chart-2))' : 'hsl(var(--destructive))'}; color: white;">${user.kyc}</span>
        </div>
        <div>
          <div class="stat-label">Date Joined</div>
          <div class="stat-value">${new Date(user.dateJoined).toLocaleDateString()}</div>
        </div>
        <div>
          <div class="stat-label">Balance</div>
          <div style="font-size: 1.5rem; font-weight: 700;">${money(user.balance)}</div>
        </div>
        <div>
          <div class="stat-label">Total Profit</div>
          <div style="font-size: 1.5rem; font-weight: 700; color: hsl(var(--chart-2));">${money(user.profit)}</div>
        </div>
       
      </div>
      <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
        <button class="btn btn-primary" onclick="handleEditProfile()">Edit Profile</button>
        <button class="btn" style="background-color: transparent; border: 1px solid hsl(var(--border)); color: hsl(var(--foreground));" onclick="handleUpdateKYC()">Update KYC</button>
      </div>
     <button class="btn" style="background-color: transparent;margin-top:10px;  border: 1px solid hsl(var(--border)); color: hsl(var(--foreground));" onclick="handleChangePassword()">Change Password</button>
     <button class="btn" style="background-color: transparent;margin-top:10px;  border: 1px solid hsl(var(--destructive)); color: hsl(var(--destructive));" onclick="logoutUser()">Log Out</button>

    </div>
  `;
  
  content.innerHTML = html;
}
async function handleChangePassword() {
  // Fetch user info from localStorage/server
  const storedUser = localStorage.getItem('userData');
  if (!storedUser) return alert('No user data found');

  const userFromLS = JSON.parse(storedUser);

  let userInfo;
  try {
    const response = await $.ajax({
      type: "GET",
      url: `https://vantage-render.onrender.com/users/${userFromLS.email}`, // Adjust your endpoint
      dataType: "json",
      timeout: 30000
    });
    userInfo = response.data;
    localStorage.setItem("userData", JSON.stringify(userInfo));
  } catch (err) {
    console.error('Error fetching user info:', err);
    return alert('Failed to fetch user info.');
  }

  // SweetAlert form for password
  const { value: formValues } = await Swal.fire({
    title: 'Change Password',
    html: `
      <input type="password" id="swalNewPassword" class="swal2-input" placeholder="New Password">
      <input type="password" id="swalConfirmPassword" class="swal2-input" placeholder="Confirm Password">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Save Password',
    preConfirm: () => {
      return {
        password: document.getElementById('swalNewPassword').value.trim(),
        confirmPassword: document.getElementById('swalConfirmPassword').value.trim()
      };
    }
  });

  if (!formValues) return; // User canceled

  const { password, confirmPassword } = formValues;

  if (!password || !confirmPassword) return Swal.fire('Error', 'Both fields are required', 'error');
  if (password !== confirmPassword) return Swal.fire('Error', 'Passwords do not match', 'error');

  // Show loading indicator
  Swal.fire({ title: 'Updating...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  // Send request to backend
  try {
    await $.ajax({
      type: "PUT",
      url: `https://vantage-render.onrender.com/auth/${userInfo._id}/reset-password`,
      dataType: "json",
      data: { password },
      timeout: 30000
    });

    Swal.fire({
      title: "Success",
      text: "Your password has been successfully reset.",
      icon: "success",
      timer: 3000
    });

    

  } catch (err) {
    console.error('Error resetting password:', err);
    Swal.fire('Error', 'Failed to reset password. Please try again.', 'error');
  }
}


async function handleUpdateKYC() {
  // Create modal overlay
  const modal = document.createElement('div');
  modal.classList.add('modal-overlay');
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `;

  // Modal content
  modal.innerHTML = `
    <div class="modal-card" style="
      background: hsl(var(--card));
      padding: 2rem;
      border-radius: 1rem;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      text-align: center;
      position: relative;
    ">
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">KYC Verification</h2>
      <p style="font-size: 0.9rem; color: hsl(var(--muted-foreground)); margin-bottom: 1rem;">
        Please upload a clear photo of your valid ID card or passport and enter the document number below.
      </p>

      <input type="text" id="documentNumber" placeholder="Enter document number" style="
        width: 100%;
        padding: 0.5rem;
        border: 1px solid hsl(var(--border));
        border-radius: 0.5rem;
        margin-bottom: 1rem;
      " />

      <input type="file" id="image-upload" accept="image/*" style="
        display: block;
        margin: 0 auto 1rem auto;
        padding: 0.5rem;
        border: 1px solid hsl(var(--border));
        border-radius: 0.5rem;
        width: 100%;
        background: hsl(var(--background));
      ">

      <img id="image-preview" style="
        display: none;
        max-width: 100%;
        margin-bottom: 1rem;
        border-radius: 0.5rem;
        border: 1px solid hsl(var(--border));
      " />

      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button id="upload-button" class="btn btn-primary">Submit KYC</button>
        <button id="cancelKYCBtn" class="btn" style="
          background: transparent;
          border: 1px solid hsl(var(--border));
          color: hsl(var(--foreground));
        ">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // --- Cloudinary Settings ---
  const cloudName = 'dsyjlantq';
  const uploadPreset = 'assetspur';

  // --- Functions ---
  function storeImg(imageUrl, owner, docNum,ownerdet) {
    $.ajax({
      type: 'POST',
      url: 'https://vantage-render.onrender.com/auth/kyc',
      dataType: 'json',
      data: { imageUrl, owner, docNum,ownerdet },
      timeout: 30000,
      success: function () {
        localStorage.setItem("kycStatus", "pending");
        alert("Your details have been successfully uploaded. Please wait a few hours for validation.");
         renderDashboardPage();
      },
      error: function (xhr, status, error) {
        console.error('Error uploading image:', error);
        alert('Error uploading your document. Please try again.');
      }
    });
  }

  function uploadToCloudinary(file, docNum) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    })
      .then(response => response.json())
      .then(data => {
        const imageUrl = data.secure_url;
        console.log(imageUrl);
        
        localStorage.setItem("imgUrl", imageUrl);

        const userData = JSON.parse(localStorage.getItem("userData"));
        const owner = `${userData.firstName} ${userData.lastName}`;
        const ownerdet=userData._id
        storeImg(imageUrl, owner, docNum,ownerdet);
      })
      .catch(error => {
        console.error('Image upload failed:', error);
        alert('Image upload failed. Please check your internet connection.');
      });
  }

  async function fetchUserInfo() {
    const userData = JSON.parse(localStorage.getItem('userData'));
    if (!userData?.email) return;

    try {
      const response = await $.ajax({
        type: "GET",
        url: `https://vantage-render.onrender.com/users/${userData.email}`,
        dataType: "json",
        timeout: 30000
      });

      localStorage.setItem("userData", JSON.stringify(response.data));
      return response.data;
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  }

  // --- Event Listeners ---
  const imageInput = modal.querySelector('#image-upload');
  const preview = modal.querySelector('#image-preview');
  const cancelBtn = modal.querySelector('#cancelKYCBtn');
  const uploadBtn = modal.querySelector('#upload-button');

  // Preview selected image
  imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = e => {
        preview.src = e.target.result;
        preview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });

  // Cancel modal
  cancelBtn.addEventListener('click', () => modal.remove());

  // Upload KYC
  uploadBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const file = imageInput.files[0];
    const docNum = document.getElementById("documentNumber").value.trim();

    if (!file) return alert('Please select an image.');
    if (!docNum) return alert('Please enter your document number.');

    uploadBtn.textContent = "Uploading...";
    uploadBtn.disabled = true;

    uploadToCloudinary(file, docNum);
  });

  // Fetch user info on modal open
  await fetchUserInfo();
}


function renderInvestmentPage() {
  const user = getUserData();
  processDailyProfits();

  const plan = user.plan.filter(inv => inv.status === "active") || [];
  const totalPnL = Array.isArray(user.plan)
  ? user.plan.reduce((sum, plan) => sum + (Number(plan.totalProfit) || 0), 0)
  : 0;


  const investmentsHTML =
    plan.length > 0
      ? plan
          .map(inv => {
            const dailyProfit = inv.amount * inv.dailyProfitRate;
            const progress = (inv.daysElapsed / inv.duration) * 100;
            const daysRemaining = inv.duration - inv.daysElapsed;

            return `
        <div class="card" style="padding:1.5rem;margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1rem;">
            <div>
              <h3 style="font-size:1.125rem;font-weight:600;margin-bottom:0.25rem;">${inv.planName}</h3>
              <p class="text-muted small">Started ${inv.startDate}</p>
            </div>
            <span class="badge" style="background-color:hsl(var(--chart-2));color:white;padding:0.25rem 0.75rem;border-radius:0.25rem;">${inv.status}</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1rem;">
            <div>
              <div class="text-muted small">Invested Amount</div>
              <div style="font-weight:600;margin-top:0.25rem;">${money(inv.amount)}</div>
            </div>
            <div>
              <div class="text-muted small">Daily Profit</div>
              <div style="font-weight:600;color:hsl(var(--chart-2));margin-top:0.25rem;">${money(dailyProfit)} (${(
              inv.dailyProfitRate * 100
            ).toFixed(2)}%)</div>
            </div>
            <div>
              <div class="text-muted small">Total Earned</div>
              <div style="font-weight:600;color:hsl(var(--chart-2));margin-top:0.25rem;">${money(inv.totalProfit)}</div>
            </div>
            <div>
              <div class="text-muted small">Days Remaining</div>
              <div style="font-weight:600;margin-top:0.25rem;">${daysRemaining} / ${
              inv.duration
            }</div>
            </div>
          </div>

          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
              <span class="text-muted small">Progress</span>
              <span class="small" style="font-weight:600;">${progress.toFixed(1)}%</span>
            </div>
            <div style="width:100%;background-color:hsl(var(--muted));border-radius:9999px;height:8px;">
              <div style="width:${progress}%;background-color:hsl(var(--chart-2));height:100%;border-radius:9999px;transition:width 0.3s;"></div>
            </div>
          </div>
        </div>`;
          })
          .join("")
      : `<div class="card"><p class="text-muted" style="text-align:center;padding:2rem;">No active investment plans. <a href="#investment-plans" style="color:hsl(var(--primary));">Browse available plans</a></p></div>`;

  // Tables (renamed)
  const depositsTable = user.transactions?.length
    ? `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${user.transactions
            .slice()
            .reverse()
            .map(
              d => `
              <tr>
                <td>${new Date(d.timestamp).toLocaleDateString()}</td>
                <td>${money(d.amount)}</td>
                <td>${d.method}</td>
                <td><span class="badge" style="background:${
                  d.status === "Approved"
                    ? "hsl(var(--chart-2))"
                    : "hsl(var(--destructive))"
                };color:white;">${d.status}</span></td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`
    : `<p class="text-muted" style="text-align:center;padding:2rem;">No deposits found.</p>`;

  const withdrawalsTable = user.withdrawals?.length
    ? `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr><th>Date</th><th>Amount</th><th>Method</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${user.withdrawals
            .slice()
            .reverse()
            .map(
              w => `
              <tr>
                <td>${new Date(w.timestamp).toLocaleDateString()}</td>
                <td>${money(w.amount)}</td>
                <td>${w.method}</td>
                <td><span class="badge" style="background:${
                  w.status === "Approved"
                    ? "hsl(var(--chart-2))"
                    : "hsl(var(--destructive))"
                };color:white;">${w.status}</span></td>
              </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`
    : `<p class="text-muted" style="text-align:center;padding:2rem;">No withdrawals found.</p>`;

  const html = `
    <div style="margin-bottom:1.5rem;">
      <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem;">My Investments</h1>
      <p class="text-muted">Track your active investment plans, deposits, and withdrawals</p>
    </div>

    <div class="stats-grid" style="margin-bottom:1.5rem;">
      <div class="card stat-card"><div class="stat-label">Total Balance</div><div class="stat-value">${money(user.balance)}</div></div>
      <div class="card stat-card"><div class="stat-label">Active Investments</div><div class="stat-value">${plan.length}</div></div>
      <div class="card stat-card">
  <div class="stat-label">Investment Profit</div>
  <div class="stat-value" style="color:hsl(var(--chart-2));">
    ${money(plan
      .filter(inv => inv.status === "active")
      .reduce((sum, inv) => sum + parseAmount(inv.totalProfit), 0))}
  </div>
</div>

      <div class="card stat-card"><div class="stat-label">Total P&L</div><div class="stat-value" style="color:${
        totalPnL >= 0 ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"
      };">${totalPnL >= 0 ? "+" : ""}${money(totalPnL)}</div></div>
    </div>

    ${plan.length > 0 ? `<h2 style="font-size:1.125rem;font-weight:600;margin-bottom:1rem;">Active Investment Plans</h2>${investmentsHTML}` : investmentsHTML}

    <div class="card" style="margin-top:1.5rem;">
      <div style="display:flex;justify-content:center;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
        <button class="tab-btn active" data-tab="investments">Investments</button>
        <button class="tab-btn" data-tab="deposits">Deposits</button>
        <button class="tab-btn" data-tab="withdrawals">Withdrawals</button>
      </div>

      <div id="tab-content">
        <div id="tab-investments">${user.plan.length ? `
          <div class="table-scroll">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Profit</th><th>Status</th></tr></thead>
              <tbody>
                ${user.plan
                  .slice()
                  .reverse()
                  .map(
                    t => `
                    <tr>
                      <td>${new Date(t.timestamp).toLocaleDateString()}</td>
                      <td>${t.planName}</td>
                      <td>${money(t.amount)}</td>
                      <td>${money(t.totalProfit)}</td>
                      <td><span class="badge" style="${
                        t.status === "active" || t.status === "completed"
                          ? "background-color:hsl(var(--chart-2));color:white;"
                          : ""
                      }">${t.status}</span></td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>` : `<p class="text-muted" style="text-align:center;padding:2rem;">No investments yet.</p>`}
        </div>
        <div id="tab-deposits" style="display:none;">${depositsTable}</div>
        <div id="tab-withdrawals" style="display:none;">${withdrawalsTable}</div>
      </div>
    </div>

    <style>
      .tab-btn {
        background: none;
        color: hsl(var(--foreground));
        border: 1px solid hsl(var(--border));
        padding: 0.5rem 1rem;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 600;
        transition: 0.2s;
      }
      .tab-btn:hover { background: hsl(var(--muted)); }
      .tab-btn.active { background: hsl(var(--chart-2)); color: white; }

      .table-scroll {
        overflow-x: auto;
        width: 100%;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 700px;
      }
      .data-table th, .data-table td {
        text-align: left;
        padding: 0.75rem;
        border-bottom: 1px solid hsl(var(--border));
        white-space: nowrap;
      }
      .data-table th {
        color: hsl(var(--muted-foreground));
        text-transform: uppercase;
        font-size: 0.75rem;
      }
    </style>
  `;

  content.innerHTML = html;

  // New tab switcher logic
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.dataset.tab;
      document.querySelectorAll("#tab-content > div").forEach(div => (div.style.display = "none"));
      document.getElementById("tab-" + target).style.display = "block";
    });
  });
}

function renderInvestmentPlansPage() {
  const user = getUserData();
  const plans = getInvestmentPlans();
  
  // Process daily profits on page load
  processDailyProfits();
  
  const plansHTML = plans.map(plan => {
    const totalReturn = plan.dailyProfitRate * plan.duration * 100;
    return `
      <div class="card" style="padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${plan.color};"></div>
              <h3 style="font-size: 1.25rem; font-weight: 600;">${plan.name}</h3>
            </div>
            <p class="text-muted small">${plan.description}</p>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem; padding: 1rem; background-color: hsl(var(--muted)); border-radius: 0.375rem;">
          <div>
            <div class="text-muted small">Min Investment</div>
            <div style="font-weight: 600; margin-top: 0.25rem;">${money(plan.minInvestment)}</div>
          </div>
          <div>
            <div class="text-muted small">Max Investment</div>
            <div style="font-weight: 600; margin-top: 0.25rem;">${typeof plan.maxInvestment === "number" ? money(plan.maxInvestment) : plan.maxInvestment}</div>
          </div>
          <div>
            <div class="text-muted small">Daily Profit</div>
            <div style="font-weight: 600; color: hsl(var(--chart-2)); margin-top: 0.25rem;">${(plan.dailyProfitRate * 100).toFixed(2)}%</div>
          </div>
          <div>
            <div class="text-muted small">Total Return</div>
            <div style="font-weight: 600; color: hsl(var(--chart-2)); margin-top: 0.25rem;">${totalReturn.toFixed(0)}%</div>
          </div>
          <div>
            <div class="text-muted small">Duration</div>
            <div style="font-weight: 600; margin-top: 0.25rem;">${plan.durationn} Hours</div>
          </div>
          <div>
            <div class="text-muted small">Your Balance</div>
            <div style="font-weight: 600; margin-top: 0.25rem;">${money(user.balance)}</div>
          </div>
        </div>
        
        <div style="display: flex; gap: 0.75rem;">
          <input type="text" inputmode="decimal" id="amount-${plan.id}" class="input" placeholder="Enter amount (${currencySymbol()})" style="flex: 1;">
          <button class="btn btn-primary" onclick="handlePurchasePlan('${plan.id}')" style="white-space: nowrap;">Invest Now</button>
        </div>
      </div>
    `;
  }).join('');
  
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Investment Plans 📈</h1>
      <p class="text-muted">Choose a plan and start earning daily profits for 90 days</p>
    </div>
    
    <div class="stats-grid" style="margin-bottom: 1.5rem;">
      <div class="card stat-card">
        <div class="stat-label">Current Balance</div>
        <div class="stat-value">${money(user.balance)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Active Investments</div>
        <div class="stat-value">${user.plan.filter(inv => inv.status === 'active').length}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Total Invested</div>
        <div class="stat-value">${money(user.plan.filter(inv => inv.status === 'active').reduce((sum, inv) => sum + parseAmount(inv.amount), 0))}</div>
      </div>
      <div class="card stat-card">
  <div class="stat-label">Active Earnings</div>
  <div class="stat-value" style="color: hsl(var(--chart-2));">
    ${money(user.plan
      .filter(inv => inv.status === "active")
      .reduce((sum, inv) => sum + parseAmount(inv.totalProfit), 0))}
  </div>
</div>

      <div class="card stat-card">
        <div class="stat-label">Total Earnings</div>
        <div class="stat-value" style="color: hsl(var(--chart-2));">${money(user.plan.reduce((sum, inv) => sum + parseAmount(inv.totalProfit), 0))}</div>
      </div>
    </div>
    
    <div style="display: grid; gap: 1rem;">
      ${plansHTML}
    </div>
  `;
  
  content.innerHTML = html;
}

async function handleWithdrawal() {
  const user = getUserData();
  const type = document.getElementById('withdrawalType').value;
  const method = document.getElementById('withdrawalWallet').value;
  const amount = toUSD(document.getElementById('withdrawalAmount').value);
  const address = document.getElementById('withdrawalAddress').value;

  // 🟢 Basic validation
  if (!type) return Swal.fire({ icon: 'warning', title: 'Missing Type', text: 'Select a withdrawal wallet.' });
  if (!method) return Swal.fire({ icon: 'warning', title: 'Missing Method', text: 'Select a withdrawal method.' });
  if (amount < 10) return Swal.fire({ icon: 'warning', title: 'Invalid Amount', text: `Minimum withdrawal is ${money(10)}.` });

  // 🟠 Choose the correct wallet dynamically
  const available = parseAmount(type === 'Balance' ? user.balance : user.profit);

  if (amount > available) {
    Swal.fire({
      icon: 'error',
      title: 'Insufficient Funds',
      text: `You do not have enough ${type.toLowerCase()} for this withdrawal.`,
    });
    return;
  }

  // 🟣 Common withdrawal handler
  await addWithdrawal({
    method,
    amount,
    address,
    to: user.email,
    from: user.firstName + " " + user.lastName,
    source: type, // optional: to track where it came from
  });

  console.log(  method,
    amount,
    address,
   type,);
  
  Swal.fire({
    icon: 'success',
    title: 'Withdrawal Submitted!',
    html: `<strong>Type:</strong> ${type}<br><strong>Method:</strong> ${method}<br><strong>Amount:</strong> ${money(amount)}<br><strong>Address:</strong> ${address}`,
  });

  renderWithdrawalPage();
}
// Shared history table for deposits (user.transactions) and withdrawals
function renderMoneyHistory(title, items, emptyText) {
  const list = Array.isArray(items) ? items : [];
  return `
    <div class="card" style="margin-top: 2rem; max-width: 42rem;">
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">${title}</h2>
      ${list.length ? `
      <div class="table-container">
        <table>
          <thead>
            <tr><th>Date</th><th>Method</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${list.slice().reverse().map(item => `
              <tr>
                <td>${new Date(item.timestamp).toLocaleDateString()}</td>
                <td>${item.method || '—'}</td>
                <td>${money(item.amount)}</td>
                <td><span class="badge">${item.status || '—'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>` : `<p class="text-muted" style="text-align: center; padding: 1.5rem 0;">${emptyText}</p>`}
    </div>
  `;
}

function renderDepositHistory(user) {
  return renderMoneyHistory('Deposit History', user.transactions, 'No deposits yet.');
}

function renderWithdrawalHistory(user) {
  return renderMoneyHistory('Withdrawal History', user.withdrawals, 'No withdrawals yet.');
}

function renderWithdrawalPage() {
  const user = getUserData();

  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Withdrawal</h1>
      <p class="text-muted">
        Request a withdrawal from your account 
        (Balance: ${money(user.balance)} | Profit: ${money(user.profit)})
      </p>
    </div>

    <div class="card" style="max-width: 42rem;">
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem;">Make Withdrawal</h2>
      <form id="withdrawalForm">
        <div class="form-group">
          <label for="withdrawalType">Withdrawal Wallet</label>
          <select id="withdrawalType" class="input" required>
            <option value="">Select a Wallet</option>
            <option value="Balance">Balance</option> 
            <option value="Profit">Profit</option>  
          </select>
        </div>

        <div class="form-group">
          <label for="withdrawalWallet">Withdrawal Method</label>
          <select id="withdrawalWallet" class="input" required>
            <option value="">Select a Method</option>
            <option value="Bitcoin">Bitcoin</option>
            <option value="Ethereum">Ethereum</option>
            <option value="USDT">USDT (TRC20)</option>
            <option value="Litecoin">Litecoin</option>
          </select>
        </div>

        <div class="form-group">
          <label for="withdrawalAmount">Amount (${currencySymbol()})</label>
          <input type="text" inputmode="decimal" id="withdrawalAmount" class="input" placeholder="Enter Amount (${currencySymbol()})" required>
        </div>

        <div class="form-group">
          <label for="withdrawalAddress">Wallet Address / Bank Account</label>
          <input type="text" id="withdrawalAddress" class="input" placeholder="Enter your wallet address or bank account" required>
        </div>

        <div style="padding: 1rem; background-color: hsl(var(--muted) / 0.5); border-radius: 0.5rem; border: 1px solid hsl(var(--border)); margin-bottom: 1.5rem;">
          <p class="text-muted small">Please note: Withdrawals may take a few minutes to process.</p>
        </div>

        <button type="submit" class="btn btn-primary btn-block">Withdraw</button>
      </form>
    </div>

    ${renderWithdrawalHistory(user)}
  `;

  content.innerHTML = html;

  document.getElementById('withdrawalForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleWithdrawal();
  });
}


function renderReferralsPage() {
  const user = getUserData();
  const activeReferrals = user.referredUsers.filter(r => r.status === 'active');
  const totalEarned = user.referredUsers.reduce((sum, r) => sum + (r.earned || 0), 0);
  
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Referral Program</h1>
      <p class="text-muted">Earn rewards by inviting friends to vantagestonk</p>
    </div>
    
    <div class="stats-grid">
      <div class="card stat-card">
        <div class="stat-label">Total Referrals</div>
        <div class="stat-value">${user.referredUsers.length}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Active Referrals</div>
        <div class="stat-value">${activeReferrals.length}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Total Earned</div>
        <div class="stat-value" style="color: hsl(var(--chart-2));">${money(totalEarned)}</div>
      </div>
    </div>
    
    <div class="card" style="margin-bottom: 1.5rem;">
      <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Your Referral Code</h2>
      <p class="text-muted" style="margin-bottom: 1rem;">Share this code with your friends. They get a bonus and you earn 10% of their first deposit!</p>
      <div class="referral-code">
        <input type="text" id="referralCodeInput" class="input" value="https://www.vantagestonk.com/register?ref=${user.referralCode}" readonly>
        <button class="copy-btn" onclick="copyReferralCode()">
          <svg style="width: 1rem; height: 1rem; display: inline; vertical-align: middle; margin-right: 0.25rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
      </div>
    </div>
    
    ${user.referredUsers.length > 0 ? `
      <div class="card">
        <h2 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1rem;">Referral History</h2>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Date Joined</th>
                <th>Status</th>
                <th>Earned</th>
              </tr>
            </thead>
            <tbody>
              ${user.referredUsers.slice().reverse().map(ref => `
                <tr>
                  <td style="font-weight: 600;">${ref.name}</td>
                  <td>${new Date(ref.dateJoined).toLocaleDateString()}</td>
                  <td>
                    <span class="badge" style="${ref.status === 'active' ? 'background-color: hsl(var(--chart-2)); color: white;' : ''}">${ref.status}</span>
                  </td>
                  <td style="font-weight: 600; color: ${ref.earned > 0 ? 'hsl(var(--chart-2))' : 'inherit'};">${money(ref.earned)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div class="card">
        <p class="text-muted" style="text-align: center; padding: 2rem;">No referrals yet. Share your code and start earning!</p>
      </div>
    `}
  `;
  
  content.innerHTML = html;
}

function renderRewardsPage() {
  const user = getUserData();
  const totalClaimed = user.rewards.filter(r => r.claimed).reduce((sum, r) => sum + r.amount, 0);
  const totalAvailable = user.rewards.filter(r => !r.claimed).reduce((sum, r) => sum + r.amount, 0);
  
  const html = `
    <div style="margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">Rewards</h1>
      <p class="text-muted">Complete tasks and earn rewards</p>
    </div>
    
    <div class="stats-grid">
      <div class="card stat-card">
        <div class="stat-label">Total Claimed</div>
        <div class="stat-value" style="color: hsl(var(--chart-2));">${money(totalClaimed)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Available Rewards</div>
        <div class="stat-value">${money(totalAvailable)}</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Total Value</div>
        <div class="stat-value">${money(totalClaimed + totalAvailable)}</div>
      </div>
    </div>
    
    <div style="display: grid; gap: 1rem;">
      ${user.rewards.map((reward, index) => `
        <div class="reward-card ${reward.claimed ? 'claimed' : ''}">
          <div class="reward-icon">
            ${getRewardIcon(reward.id)}
          </div>
          <div class="reward-info">
            <h3>${reward.title}</h3>
            <p>${reward.description}</p>
          </div>
          <div style="text-align: right;">
            <div class="reward-amount">${money(reward.amount)}</div>
            ${reward.claimed 
              ? '<span class="badge">Claimed</span>' 
              : `<button class="btn btn-primary" style="margin-top: 0.5rem; padding: 0.375rem 0.75rem; font-size: 0.75rem;" onclick="handleClaimReward('${reward.id}', '${reward.title}', ${reward.amount})">Claim</button>`
            }
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  content.innerHTML = html;
}

function getRewardIcon(type) {
  const icons = {
    'welcome': '<path d="M20 12v10H4V12"></path><path d="M2 7h20v5H2z"></path><line x1="12" y1="22" x2="12" y2="7"></line><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"></path><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"></path>',
    'first-deposit': '<line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>',
    'first-trade': '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>',
    'weekly-trader': '<circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>',
    'copy-trading': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${icons[type] || icons['welcome']}</svg>`;
}

// ==================== HELPER FUNCTIONS ====================

function copyReferralCode() {
  const input = document.getElementById('referralCodeInput');
  input.select();
  document.execCommand('copy');
  apiLog('REFERRAL_CODE_COPIED', { code: input.value });
  Swal.fire({ icon: 'success', title: 'Copied!', text: 'Referral code copied to clipboard!', timer: 2000, showConfirmButton: false });
}

function handleClaimReward(rewardId, title, amount) {
  if (claimReward(rewardId)) {
    Swal.fire({ 
      icon: 'success', 
      title: 'Reward Claimed!', 
      html: `<strong>${title}</strong><br>${money(amount)}<br><br>Your new balance has been updated!`,
      confirmButtonText: 'OK' 
    }).then(() => {
      renderRewardsPage();
    });
  } else {
    Swal.fire({ icon: 'error', title: 'Unable to Claim', text: 'This reward may have already been claimed.', confirmButtonText: 'OK' });
  }
}

async function handleEditProfile() {
  // Fetch user info from localStorage/server
  const storedUser = localStorage.getItem('userData');
  if (!storedUser) return alert('No user data found');

  const userFromLS = JSON.parse(storedUser);

  let userInfo;
  try {
    const response = await $.ajax({
      type: "GET",
      url: `https://vantage-render.onrender.com/users/${userFromLS.email}`,
      dataType: "json",
      timeout: 30000
    });
    userInfo = response.data;
    localStorage.setItem("userData", JSON.stringify(userInfo));
  } catch (err) {
    console.error('Error fetching user info:', err);
    return alert('Failed to fetch profile info.');
  }

  // SweetAlert form
  const { value: formValues } = await Swal.fire({
    title: 'Edit Profile',
    html: `
      <input id="swalFirstName" class="swal2-input" placeholder="First Name" value="${userInfo.firstName}">
      <input id="swalLastName" class="swal2-input" placeholder="Last Name" value="${userInfo.lastName}">
      <input id="swalEmail" class="swal2-input" placeholder="Email" value="${userInfo.email}">
      <input id="swalMobile" class="swal2-input" placeholder="Mobile" value="${userInfo.mobile}">
      <input id="swalCountry" class="swal2-input" placeholder="Country" value="${userInfo.country}">
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Save Changes',
    preConfirm: () => {
      return {
        firstName: document.getElementById('swalFirstName').value.trim(),
        lastName: document.getElementById('swalLastName').value.trim(),
        email: document.getElementById('swalEmail').value.trim(),
        mobile: document.getElementById('swalMobile').value.trim(),
        country: document.getElementById('swalCountry').value.trim(),
      }
    }
  });

  if (!formValues) return; // User canceled

  // Validate inputs
  const { firstName, lastName, email, mobile, country } = formValues;
  if (!firstName || !lastName || !email) return Swal.fire('Error', 'First Name, Last Name, and Email are required', 'error');

  // Update profile via AJAX
  try {
    const updateResponse = await $.ajax({
      type: "PUT",
      url: `https://vantage-render.onrender.com/users/${userInfo._id}/profile/update`,
      dataType: "json",
      data: { firstName, lastName, email, mobile, country },
      timeout: 30000
    });

    // Update localStorage
    localStorage.setItem("userData", JSON.stringify({ ...userInfo, firstName, lastName, email, mobile, country }));

    Swal.fire('Success', 'Profile successfully updated', 'success');

    // Optionally refresh profile page
    renderProfilePage();

  } catch (err) {
    console.error('Error updating profile:', err);
    Swal.fire('Error', 'Failed to update profile', 'error');
  }
}


// ==========================
// 🔹 KYC HANDLER (All Pure JS)
// ==========================

// ==================== MODALS ====================

// Close any .modal via its × button, a click on the dark backdrop, or Escape
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.modal .modal-close');
  if (closeBtn) {
    closeBtn.closest('.modal').classList.remove('active');
    return;
  }
  if (e.target.classList && e.target.classList.contains('modal')) {
    e.target.classList.remove('active');
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
  }
});

function openTradeModal(symbol, type, price) {
  const modal = document.getElementById('tradeModal');
  document.getElementById('tradeModalTitle').textContent = `${type} ${symbol}`;
  document.getElementById('tradeModalPrice').textContent = price;
  modal.classList.add('active');
  
  const tradeData = { symbol, type, price };
  document.getElementById('placeTrade').onclick = () => {
    const amount = toUSD(document.getElementById('tradeAmount').value);
    if (amount) {
      addTransaction({
        type: 'trade',
        symbol: symbol,
        tradeType: type,
        amount: amount,
        price: price,
        status: 'active'
      });
      
      Swal.fire({ 
        icon: 'success', 
        title: 'Order Placed!', 
        html: `<strong>${type} ${symbol}</strong><br>Amount: ${money(amount)}<br>Price: ${price}`,
        confirmButtonText: 'OK' 
      });
      modal.classList.remove('active');
      document.getElementById('tradeAmount').value = '';
    }
  };
}

function openCopyTradeModal(btn) {
  // Convert button dataset into a trader object
  const trader = {
    name: btn.dataset.name,
    level: btn.dataset.level,
    rating: btn.dataset.rating,
    trades: JSON.parse(btn.dataset.trades || "[]"),
    numberOfTrades: btn.dataset.numberoftrades,
    commission: btn.dataset.commission,
    pnl: btn.dataset.pnl,
     photo: btn.dataset.photo,
    profileId: btn.dataset.profileid,
    accountLevel: btn.dataset.accountlevel,
    type: btn.dataset.type,
    history: JSON.parse(btn.dataset.history || "[]"),
    followers: btn.dataset.followers,
    watchers: btn.dataset.watchers,
    profitableTrade: btn.dataset.profitabletrade
  };

  // For debugging
  console.log("Trader info:", trader);

  const modal = document.getElementById('copyTradeModal');
  const profile = document.getElementById('copyTraderProfile');

  profile.innerHTML = `
    <div class="trader-avatar" style="background-color: hsl(var(--primary) / 0.2); display: flex; align-items: center; justify-content: center; font-weight: 600; color:#0fef9e; border: 2px solid#0fef9e;">
       <img src=${trader.photo} style="width:50px; height:50px; border-radius:50%;"/>
         
    </div>
    <div style="flex: 1;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <div>
          <h3 style="font-weight: 600; margin-bottom: 0.25rem;">${trader.name}</h3>
          <span class="badge">${trader.level}</span>
        </div>
        <div style="text-align: right;">
          <div class="stat-label">Status</div>
          <div style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.75rem;">
            <div style="width: 0.5rem; height: 0.5rem; border-radius: 50%; background-color: hsl(var(--chart-2));"></div>
            <span>online</span>
          </div>
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; font-size: 0.875rem; margin-top: 1rem;">
        <div>
          <div class="stat-label">Profile ID</div>
          <div class="stat-value">${trader.profileId}</div>
        </div>
        <div>
          <div class="stat-label">Account Level</div>
          <div class="stat-value">${trader.accountLevel}</div>
        </div>
        <div>
          <div class="stat-label">Followers</div>
          <div class="stat-value">${trader.followers}</div>
        </div>
        <div>
          <div class="stat-label">Watchers</div>
          <div class="stat-value">${trader.watchers}</div>
        </div>
        <div>
          <div class="stat-label">Number of Trades</div>
          <div class="stat-value">${trader.numberOfTrades}</div>
        </div>
        <div>
          <div class="stat-label">Profitable Trade %</div>
          <div class="stat-value">${trader.profitableTrade}</div>
        </div>
      </div>
    </div>
  `;

  modal.classList.add('active');

  // Copy Trade start button logic
 // Copy Trade start button logic
document.getElementById("startCopyTrade").onclick = async () => {
  const amount = toUSD(document.getElementById("copyAmount").value);
  const duration = parseInt(document.getElementById("copyDuration").value);

  if (!amount || !duration) {
    Swal.fire({
      icon: "warning",
      title: "Missing Fields",
      text: "Please enter both amount and duration.",
    });
    return;
  }

  const user = getUserData(); // from local storage/session
  const traderName = trader.name; // variable passed from openCopyTradeModal()

  // Check if user has enough balance
  if (parseAmount(user.balance) < amount) {
    Swal.fire({
      icon: "error",
      title: "Insufficient Balance",
      text: `You only have ${money(user.balance)} available, which is not enough for this trade.`,
    });
    return;
  }


  try {
    const res = await fetch("https://vantage-render.onrender.com/transactions/copy-trade/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user._id,
        traderName,
        amount,
        duration,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      Swal.fire({
        icon: "success",
        title: "Copy Trade Started!",
        html: `
          <strong>Trader:</strong> ${traderName}<br>
          <strong>Amount:</strong> ${money(amount)}<br>
          <strong>Duration:</strong> ${duration} days
        `,
      });

      // Update user locally
      user.copyTradingActive = user.copyTradingActive || [];
      user.copyTradingActive.push(data.data);
      updateUserData(user);

      // Close modal and reset
      document.getElementById("copyTradeModal").classList.remove("active");
      document.getElementById("copyAmount").value = "";
      document.getElementById("copyDuration").value = "";
var userCopyTrades=user.copyTradingActive
      renderCopyTradingHistory(userCopyTrades)
    } else {
      Swal.fire({ icon: "error", title: "Failed", text: data.error });
    }
  } catch (err) {
    console.error(err);
    Swal.fire({
      icon: "error",
      title: "Server Error",
      text: "Something went wrong. Try again later.",
    });
  }
};

}
function renderCopyTradingHistory(userCopyTrades) {
  // Get container or create one
 let container = document.getElementById("content");
container.innerHTML = ""; // clears previous content
// append table inside container

  if (!container) {
    container = document.createElement("div");
    container.id = "copyTradeHistoryContainer";
    container.style.width = "100%";
    container.style.marginTop = "2rem";
    document.body.appendChild(container);
  }

  // Clear previous content
  container.innerHTML = "";

  // Title
  const title = document.createElement("h2");
  title.textContent = "Copy Trading History";
  title.style.fontSize = "1.75rem";
  title.style.fontWeight = "700";
  title.style.marginBottom = "1rem";
  title.style.color = "hsl(var(--foreground))";
  container.appendChild(title);

  // Table container
  const tableContainer = document.createElement("div");
  tableContainer.style.overflowX = "auto";
  container.appendChild(tableContainer);

  // Table
  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";
  table.style.minWidth = "600px";

  // Header
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = ["Trader", "Amount", "Duration", "Start Date", "Status", "Action"];
  headers.forEach(h => {
    const th = document.createElement("th");
    th.textContent = h;
    th.style.padding = "12px 8px";
    th.style.textAlign = "left";
    th.style.borderBottom = "1px solid hsl(var(--border))";
    th.style.color = "hsl(var(--muted-foreground))";
    th.style.backgroundColor = "hsl(var(--card))";
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");

  userCopyTrades.forEach(trade => {
    const tr = document.createElement("tr");

    // Trader
    const tdTrader = document.createElement("td");
    tdTrader.textContent = trade.trader ?? "Unknown";
    tdTrader.style.padding = "10px 8px";
    tdTrader.style.color = "hsl(var(--foreground))";
    tr.appendChild(tdTrader);

    // Amount
    const tdAmount = document.createElement("td");
    tdAmount.textContent = trade.amount != null ? money(trade.amount) : "-";
    tdAmount.style.padding = "10px 8px";
    tdAmount.style.color = "hsl(var(--accent))";
    tr.appendChild(tdAmount);

    // Duration
    const tdDuration = document.createElement("td");
    tdDuration.textContent = trade.duration ? `${trade.duration} days` : "-";
    tdDuration.style.padding = "10px 8px";
    tdDuration.style.color = "hsl(var(--foreground))";
    tr.appendChild(tdDuration);

    // Start Date
    const tdDate = document.createElement("td");
    tdDate.textContent = trade.startDate ? new Date(trade.startDate).toLocaleString() : "-";
    tdDate.style.padding = "10px 8px";
    tdDate.style.color = "hsl(var(--muted-foreground))";
    tr.appendChild(tdDate);

    // Status
    const tdStatus = document.createElement("td");
    tdStatus.textContent = trade.status ?? "-";
    tdStatus.style.padding = "10px 8px";
    tdStatus.style.fontWeight = "600";
    tdStatus.style.color = trade.status === "ACTIVE" ? "hsl(var(--primary))" : "hsl(var(--destructive))";
    tr.appendChild(tdStatus);

    // Action
    // const tdAction = document.createElement("td");
    // const btn = document.createElement("button");
    // btn.textContent = "View";
    // btn.style.padding = "6px 12px";
    // btn.style.border = "none";
    // btn.style.borderRadius = "6px";
    // btn.style.cursor = "pointer";
    // btn.style.backgroundColor = "hsl(var(--primary))";
    // btn.style.color = "hsl(var(--primary-foreground))";
    // btn.onmouseover = () => btn.style.backgroundColor = "hsl(var(--primary-hover))";
    // btn.onmouseout = () => btn.style.backgroundColor = "hsl(var(--primary))";
    // tdAction.appendChild(btn);
    // tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  tableContainer.appendChild(table);
}


// ==================== LOGOUT ====================
async function logoutUser() {
  const result = await Swal.fire({
    icon: 'question',
    title: 'Log out?',
    text: 'You will need to sign in again to access your account.',
    showCancelButton: true,
    confirmButtonText: 'Log Out',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#dc2626'
  });
  if (!result.isConfirmed) return;

  ['userData', 'kycStatus', 'imgUrl', 'apiLogs', 'investmentPlans'].forEach(k => localStorage.removeItem(k));
  window.location.href = '/login';
}

// ==================== INITIALIZATION ====================

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
    localStorage.removeItem('investmentPlans');
  if (!initUserData()) return;
  await initCurrency();
  initTheme();
  updateSidebarUserInfo();
  const savedPage = decodeURIComponent(location.hash.slice(1));
  loadPage(RESTORABLE_PAGES.includes(savedPage) ? savedPage : 'dashboard');
});

// Update sidebar with user info
function updateSidebarUserInfo() {
  const user = getUserData();
  const displayName = `${user.firstName}${user.lastName}`;
  const initials = (user.firstName[0] + user.lastName[0]).toUpperCase();
  
  // Update username in sidebar if element exists
  const usernameEl = document.getElementById('sidebarUsername');
  if (usernameEl) usernameEl.textContent = displayName;
  
  // Update avatar if element exists
  const avatarEl = document.getElementById('sidebarAvatar');
  if (avatarEl) avatarEl.textContent = initials;
  
  // Update balance if element exists
  const balanceEl = document.getElementById('sidebarBalance');
  if (balanceEl) balanceEl.textContent = money(user.balance);
}