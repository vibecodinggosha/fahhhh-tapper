const express = require("express");
const cors    = require("cors");

const app     = express();
const PORT    = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-memory store — persists while the process runs
const players = {};

// GET /leaderboard — топ-100
app.get("/leaderboard", (req, res) => {
  const list = Object.values(players)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 100);
  res.json({ players: list });
});

// POST /score — сохранить счёт
app.post("/score", (req, res) => {
  const { userId, name, balance, taps } = req.body;
  if (!userId) return res.status(400).json({ error: "no userId" });
  const existing = players[userId];
  if (existing && existing.balance > parseFloat(balance)) {
    return res.json({ ok: true, note: "existing score higher" });
  }
  players[userId] = {
    userId,
    name:    (name || "Anonymous").slice(0, 32),
    balance: parseFloat(balance) || 0,
    taps:    parseInt(taps)      || 0,
    ts:      Date.now(),
  };
  res.json({ ok: true });
});

app.get("/health", (_, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`FAHHHH API running on :${PORT}`));
