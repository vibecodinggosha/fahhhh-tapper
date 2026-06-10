const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");

const app     = express();
const DB_FILE = path.join(__dirname, "leaderboard.json");
const PORT    = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function readDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { players: {} }; }
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data));
}

// GET /leaderboard — топ-100
app.get("/leaderboard", (req, res) => {
  const { players } = readDB();
  const list = Object.values(players)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 100);
  res.json({ players: list });
});

// POST /score — сохранить счёт
app.post("/score", (req, res) => {
  const { userId, name, balance, taps } = req.body;
  if (!userId) return res.status(400).json({ error: "no userId" });
  const db = readDB();
  const existing = db.players[userId];
  if (existing && existing.balance > parseFloat(balance)) {
    return res.json({ ok: true, note: "existing score higher" });
  }
  db.players[userId] = {
    userId,
    name:    (name || "Anonymous").slice(0, 32),
    balance: parseFloat(balance) || 0,
    taps:    parseInt(taps)      || 0,
    ts:      Date.now(),
  };
  writeDB(db);
  res.json({ ok: true });
});

// GET /rank/:userId — ранк игрока
app.get("/rank/:userId", (req, res) => {
  const { players } = readDB();
  const sorted = Object.values(players).sort((a, b) => b.balance - a.balance);
  const rank   = sorted.findIndex(p => p.userId === req.params.userId) + 1;
  res.json({ rank: rank || null, total: sorted.length });
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`FAHHHH API running on :${PORT}`));
