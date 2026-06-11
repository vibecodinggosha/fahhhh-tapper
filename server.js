import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app      = express();
const PORT     = process.env.PORT || 3000;

// DATA_DIR defaults to the server's own directory so players.json is always
// written to ~/fahhhh-api/players.json regardless of CWD when PM2 starts.
const DATA_DIR  = process.env.DATA_DIR || __dirname;
const DATA_FILE = path.join(DATA_DIR, "players.json");

app.use(cors());
app.use(express.json());

// ── Persistence ────────────────────────────────────────────
let players = {};
// Tracks whether we have a trustworthy picture of on-disk data. If startup
// load fails (corrupted/partial file), this stays false and we refuse to
// overwrite the existing files — otherwise the 5s autosave would wipe a good
// leaderboard with an empty {} after a single bad read. This was the bug that
// kept resetting the board.
let loadedOk = false;
let skipWarnLogged = false;

console.log(`Data file: ${DATA_FILE}`);
for (const f of [DATA_FILE, DATA_FILE + ".bak"]) {
  try {
    if (fs.existsSync(f)) {
      const parsed = JSON.parse(fs.readFileSync(f, "utf8"));
      if (parsed && typeof parsed === "object") {
        players = parsed;
        loadedOk = true;
        console.log(`Loaded ${Object.keys(players).length} players from ${f}`);
        break;
      }
    }
  } catch (e) {
    console.error(`Failed to load ${f}:`, e.message);
  }
}
// Genuinely fresh server (no files at all) — saving is safe from the start.
if (!loadedOk && !fs.existsSync(DATA_FILE) && !fs.existsSync(DATA_FILE + ".bak")) {
  loadedOk = true;
  console.log("No existing data files — starting fresh.");
}

function savePlayers() {
  const count = Object.keys(players).length;
  // Never clobber existing data with an empty set. Covers two cases:
  //  1. Startup load failed → players is {} but real files still on disk.
  //  2. loadedOk is false → we don't trust our in-memory state yet.
  if (count === 0 && (fs.existsSync(DATA_FILE) || fs.existsSync(DATA_FILE + ".bak"))) {
    if (!skipWarnLogged) {
      console.error("Skipping save: refusing to overwrite existing data with empty set");
      skipWarnLogged = true;
    }
    return;
  }
  if (!loadedOk && count === 0) {
    return;
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + ".tmp";
    const data = JSON.stringify(players);
    fs.writeFileSync(tmp, data, "utf8");
    fs.renameSync(tmp, DATA_FILE);
    fs.writeFileSync(DATA_FILE + ".bak", data, "utf8");
    loadedOk = true; // we now have a confirmed-good on-disk snapshot
  } catch (e) {
    console.error("Failed to save players.json:", e.message);
  }
}

// Save every 5 seconds
setInterval(savePlayers, 5_000);

// Save on any kind of shutdown signal
const shutdown = () => { savePlayers(); process.exit(0); };
process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);
process.on("SIGHUP",  shutdown);
process.on("beforeExit", savePlayers);
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  savePlayers();
  process.exit(1);
});

// ── Constants ───────────────────────────────────────────────
const REF_BOOST_MS = 30 * 60 * 1000;

const REFERRAL_MSG = {
  ru: (name, until) => `🎉 Новый реферал!\n${name} зашёл по твоей ссылке.\n⚡ x2 бонус активен до ${until}`,
  en: (name, until) => `🎉 New referral!\n${name} joined via your link.\n⚡ x2 bonus active until ${until}`,
  zh: (name, until) => `🎉 新推荐！\n${name} 通过你的链接加入。\n⚡ x2奖励激活至 ${until}`,
  ar: (name, until) => `🎉 إحالة جديدة!\n${name} انضم عبر رابطك.\n⚡ مكافأة x2 نشطة حتى ${until}`,
  hi: (name, until) => `🎉 नया रेफरल!\n${name} आपके लिंक से जुड़ा।\n⚡ x2 बोनस ${until} तक सक्रिय`,
};

// ── Routes ──────────────────────────────────────────────────

// GET /leaderboard
app.get("/leaderboard", (req, res) => {
  const list = Object.values(players)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 100);
  console.log(`GET /leaderboard → ${list.length} players`);
  res.json({ players: list });
});

// POST /score
app.post("/score", (req, res) => {
  const { userId, name, balance, taps, lang } = req.body;
  console.log(`POST /score userId=${userId} name=${name} balance=${balance}`);
  if (!userId) return res.status(400).json({ error: "no userId" });
  const existing = players[userId];
  if (existing && existing.balance > parseFloat(balance)) {
    if (lang) existing.lang = lang;
    return res.json({ ok: true, note: "existing score higher" });
  }
  players[userId] = {
    ...(players[userId] || {}),
    userId,
    name:    (name || "Anonymous").slice(0, 32),
    balance: parseFloat(balance) || 0,
    taps:    parseInt(taps)      || 0,
    lang:    lang || players[userId]?.lang || "ru",
    ts:      Date.now(),
  };
  console.log(`  → saved, total players: ${Object.keys(players).length}`);
  res.json({ ok: true });
});

// POST /referral
app.post("/referral", async (req, res) => {
  const { referrerId, newUserId, newUserName } = req.body;
  if (!referrerId || !newUserId || referrerId === newUserId)
    return res.status(400).json({ error: "invalid" });

  if (!players[referrerId]) {
    players[referrerId] = { userId: referrerId, name: "Unknown", balance: 0, taps: 0, ts: Date.now() };
  }
  const p = players[referrerId];
  const base = Math.max(p.refBoostUntil || 0, Date.now());
  p.refBoostUntil = base + REF_BOOST_MS;
  p.referrals = (p.referrals || 0) + 1;
  p.referralIds = p.referralIds || [];
  if (!p.referralIds.includes(newUserId)) p.referralIds.push(newUserId);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (token) {
    const lang  = p.lang || "ru";
    const msgFn = REFERRAL_MSG[lang] || REFERRAL_MSG.ru;
    const until = new Date(p.refBoostUntil).toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit" });
    const text  = msgFn(newUserName || "Кто-то", until);
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: referrerId, text }),
      });
    } catch {}
  }
  res.json({ ok: true, refBoostUntil: p.refBoostUntil });
});

// GET /check-ref/:userId
app.get("/check-ref/:userId", (req, res) => {
  const p = players[req.params.userId];
  const referralIds = p?.referralIds || [];
  const referralList = referralIds.map(uid => {
    const r = players[uid];
    return { userId: uid, name: r?.name || "Unknown", balance: r?.balance || 0, taps: r?.taps || 0 };
  }).sort((a, b) => b.balance - a.balance);
  res.json({ refBoostUntil: p?.refBoostUntil || 0, referrals: p?.referrals || 0, referralList });
});

// POST /withdraw
app.post("/withdraw", async (req, res) => {
  const { wallet, amount, userId, name, balance } = req.body;
  if (!wallet || !amount) return res.status(400).json({ error: "missing fields" });

  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  if (token && chatId) {
    const text = `💸 Заявка на вывод FAHHHH\n\nПользователь: ${name || "Anonymous"} (${userId || "?"})\nКошелёк: ${wallet}\nСумма: ${amount} FAHHHH\nБаланс: ${balance} FAHHHH`;
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch (e) {
      console.error("Telegram notify failed:", e.message);
    }
  }
  res.json({ ok: true });
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`FAHHHH API running on :${PORT}`));
