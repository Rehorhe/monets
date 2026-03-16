const COINS = [
  {
    id: "ethereum",
    symbol: "ETH",
    name: "Ethereum",
    icon: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
    amount: 9.1412,
  },
  {
    id: "bitcoin",
    symbol: "BTC",
    name: "Bitcoin",
    icon: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    amount: 0.2558,
  },
  {
    id: "litecoin",
    symbol: "LTC",
    name: "Litecoin",
    icon: "https://assets.coingecko.com/coins/images/2/large/litecoin.png",
    amount: 65.1612,
  },
  {
    id: "solana",
    symbol: "SOL",
    name: "Solana",
    icon: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
    amount: 34.6544,
  },
  {
    id: "binancecoin",
    symbol: "BNB",
    name: "BNB Smart Chain",
    icon: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
    amount: 1.0015,
  },
  {
    id: "the-open-network",
    symbol: "TON",
    name: "TON",
    icon: "https://assets.coingecko.com/coins/images/17980/large/ton_symbol.png",
    amount: 120.8119,
  },
  {
    id: "ripple",
    symbol: "XRP",
    name: "XRP",
    icon: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
    amount: 33.0649,
  },
];

const STORAGE_KEY = "portfolio-holdings-v1";

const listEl = document.getElementById("portfolioList");
const totalEl = document.getElementById("totalValue");
const updatedAtEl = document.getElementById("updatedAt");
const refreshBtn = document.getElementById("refreshBtn");
const errorBox = document.getElementById("errorBox");
const rowTemplate = document.getElementById("coinRowTemplate");
const assetsCountEl = document.getElementById("assetsCount");
const dailyPnlEl = document.getElementById("dailyPnl");
const marketStatusEl = document.getElementById("marketStatus");

let state = {
  coins: loadHoldings(),
  prices: {},
};

function loadHoldings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object") {
      return COINS.map((coin) => ({ ...coin }));
    }

    return COINS.map((coin) => {
      const amount = Number(parsed[coin.id]);
      return {
        ...coin,
        amount: Number.isFinite(amount) && amount >= 0 ? amount : coin.amount,
      };
    });
  } catch {
    return COINS.map((coin) => ({ ...coin }));
  }
}

function saveHoldings() {
  const payload = {};
  state.coins.forEach((coin) => {
    payload[coin.id] = coin.amount;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function formatUsd(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatSignedUsd(value) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatUsd(Math.abs(value))}`;
}

function render() {
  listEl.innerHTML = "";
  let totalUsd = 0;
  let previousTotalUsd = 0;

  state.coins.forEach((coin) => {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);

    const iconEl = row.querySelector(".coin-icon");
    const symbolEl = row.querySelector(".coin-symbol");
    const nameEl = row.querySelector(".coin-name");
    const priceEl = row.querySelector(".coin-price");
    const changeEl = row.querySelector(".coin-change");
    const amountInputEl = row.querySelector(".coin-amount-input");
    const valueEl = row.querySelector(".coin-value");

    const coinMarket = state.prices[coin.id] || {};
    const currentPrice = Number(coinMarket.usd) || 0;
    const change24h = Number(coinMarket.usd_24h_change);
    const currentValue = currentPrice * coin.amount;
    const previousPrice =
      Number.isFinite(change24h) && change24h > -100
        ? currentPrice / (1 + change24h / 100)
        : currentPrice;
    const previousValue = previousPrice * coin.amount;

    totalUsd += currentValue;
    previousTotalUsd += previousValue;

    iconEl.src = coin.icon;
    iconEl.alt = `${coin.symbol} icon`;
    symbolEl.textContent = coin.symbol;
    nameEl.textContent = coin.name;
    priceEl.textContent = formatUsd(currentPrice);
    changeEl.textContent = formatPercent(change24h);
    changeEl.classList.remove("up", "down");
    changeEl.classList.add(change24h >= 0 ? "up" : "down");
    amountInputEl.value = String(coin.amount);
    valueEl.textContent = formatUsd(currentValue);

    amountInputEl.addEventListener("input", (event) => {
      const inputValue = Number(event.target.value.replace(",", "."));
      const safeValue = Number.isFinite(inputValue) && inputValue >= 0 ? inputValue : 0;
      coin.amount = safeValue;
      saveHoldings();
      render();
    });

    listEl.append(row);
  });

  totalEl.textContent = formatUsd(totalUsd);
  assetsCountEl.textContent = String(state.coins.length);

  const dailyPnl = totalUsd - previousTotalUsd;
  dailyPnlEl.textContent = formatSignedUsd(dailyPnl);
  dailyPnlEl.classList.remove("up", "down");
  dailyPnlEl.classList.add(dailyPnl >= 0 ? "up" : "down");
}

async function fetchPrices() {
  const ids = state.coins.map((coin) => coin.id).join(",");
  const url =
    "https://api.coingecko.com/api/v3/simple/price" +
    `?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    refreshBtn.disabled = true;
    errorBox.textContent = "";
    marketStatusEl.textContent = "Обновление...";
    marketStatusEl.classList.remove("up", "down");

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new Error("Некорректный ответ API");
    }

    state.prices = payload;
    updatedAtEl.textContent = `Обновление: ${new Date().toLocaleTimeString("ru-RU")}`;
    marketStatusEl.textContent = "Онлайн";
    marketStatusEl.classList.add("up");
    render();
  } catch (error) {
    errorBox.textContent =
      "Не удалось обновить цены. Проверьте интернет или попробуйте повторить запрос через минуту.";
    marketStatusEl.textContent = "Сбой API";
    marketStatusEl.classList.add("down");
    if (!Object.keys(state.prices).length) {
      render();
    }
    console.error("Ошибка загрузки цен:", error);
  } finally {
    clearTimeout(timeoutId);
    refreshBtn.disabled = false;
  }
}

refreshBtn.addEventListener("click", fetchPrices);

render();
fetchPrices();
setInterval(fetchPrices, 60000);
