import { useState, useRef, useEffect, useCallback } from "react";
import {
  Pickaxe, ArrowLeftRight, BookOpen, Copy, Check,
  Zap, Trophy, Rocket, ExternalLink, Globe, ChevronDown,
  Medal, RefreshCw, User, Star, Users,
} from "lucide-react";
import { FAAAH_SRC } from "./audio.js";

const CONTRACT          = "EQASZR1GwEl7QMbQHKUdJ956HAwDw3OMq_7QPjpjcg6U18rp";
const PER_TAP           = 0.05;
const BOT_USERNAME      = import.meta.env.VITE_BOT_USERNAME || "";
const REF_BOOST_MS      = 30 * 60 * 1000;
const MAX_ENERGY        = 1000;
const HOLDER_MAX_ENERGY = 2000;
const HOLDER_BOOST_MS   = 30 * 60 * 1000;
const SCREAM_MS         = 1900;

// URL бэкенда — задаётся через секрет VITE_API_URL в GitHub Actions
const API_URL = import.meta.env.VITE_API_URL || "";

async function dbGetLeaderboard() {
  if (!API_URL) return [];
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${API_URL}/leaderboard`, { signal: ctrl.signal });
    const { players } = await res.json();
    return players || [];
  } catch { return []; }
  finally { clearTimeout(tid); }
}

async function dbSetScore({ userId, name, balance, taps, lang }) {
  if (!API_URL || !userId) return;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 5000);
  try {
    await fetch(`${API_URL}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name, balance, taps, lang }),
      signal: ctrl.signal,
    });
  } catch {}
  finally { clearTimeout(tid); }
}

async function fetchRefData(userId) {
  if (!API_URL || !userId) return { refBoostUntil: 0, referralList: [] };
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${API_URL}/check-ref/${encodeURIComponent(userId)}`, { signal: ctrl.signal });
    const data = await res.json();
    return { refBoostUntil: data.refBoostUntil || 0, referralList: data.referralList || [] };
  } catch { return { refBoostUntil: 0, referralList: [] }; }
  finally { clearTimeout(tid); }
}

async function sendReferral(referrerId, newUserId, newUserName) {
  if (!API_URL || !referrerId || !newUserId) return 0;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${API_URL}/referral`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referrerId, newUserId, newUserName }),
      signal: ctrl.signal,
    });
    const data = await res.json();
    return data.refBoostUntil || 0;
  } catch { return 0; }
  finally { clearTimeout(tid); }
}

const LEAGUES = [
  { name: "Bronze",   min: 0,    color: "#CD7F32" },
  { name: "Silver",   min: 50,   color: "#C0C0C0" },
  { name: "Gold",     min: 250,  color: "#FFD700" },
  { name: "Platinum", min: 1000, color: "#E5E4E2" },
  { name: "Diamond",  min: 5000, color: "#B9F2FF" },
];

const TABS_LABELS = {
  exchange:    { ru:"Обмен",      en:"Exchange", zh:"交易",  ar:"تبادل", hi:"विनिमय" },
  mine:        { ru:"Тапать",     en:"Mine",     zh:"挖矿",  ar:"تعدين", hi:"माइन"   },
  earn:        { ru:"Как играть", en:"Earn",     zh:"赎回",  ar:"اكسب",  hi:"कमाएं"  },
  leaderboard: { ru:"Топ",        en:"Top",      zh:"排行",  ar:"ترتيب", hi:"टॉप"    },
  friends:     { ru:"Друзья",     en:"Friends",  zh:"好友",  ar:"أصدقاء", hi:"दोस्त" },
};

const LANGUAGES = [
  { code:"ru", label:"Русский",  short:"RU" },
  { code:"en", label:"English",  short:"EN" },
  { code:"zh", label:"中文",      short:"ZH" },
  { code:"ar", label:"العربية",  short:"AR" },
  { code:"hi", label:"हिन्दी",    short:"HI" },
];

const T = {
  ru: {
    leagueLabel: n => n + " Лига",
    until: (name, val) => val.toFixed(2) + " до " + name,
    taps: n => n.toLocaleString("ru-RU") + " тапов · +" + PER_TAP + " за тап",
    boost:"Буст", tapBtn:"Тапнуть",
    exchangeTitle:"FAHHHH", exchangeSub:"Токен на блокчейне TON",
    perTap:"+" + PER_TAP + " FAHHHH за тап", yourBalance:"Твой баланс",
    contract:"Адрес контракта", copy:"Копировать", copied:"Скопировано", buyOn:"Купить / обменять",
    earnTitle:"Как зарабатывать", earnSub:"Всё что нужно знать об игре",
    checkHolder:"Проверить холдинг", checkBtn:"Проверить",
    isHolder:"Холдер FAHHHH", notHolder:"Не холдер", noToken:"На этом кошельке нет FAHHHH",
    holderBoostBtn:"Активировать бонус (+1000 энергии на 30 мин)", holderBoostDone:"Бонус активирован! ⚡",
    refTitle:"Пригласи друга", refDesc:"За каждого реферала — x2 бонус на 30 минут (суммируется)",
    refLinkLabel:"Твоя реферальная ссылка", refBoostActive: n => `⚡ x2 активен · ${n} мин`,
    refCopy:"Скопировать ссылку", refCopied:"Скопировано!",
    refShareText:"Тапай и зарабатывай FAHHHH вместе со мной!",
    refShareBtn:"Поделиться", refShareDone:"Поделились!",
    refYours:"Твои рефералы", refNone:"Пока никого нет — поделись ссылкой!",
    refCount: n => `${n} реф${n===1?"ерал":n>=2&&n<=4?"ерала":"ералов"}`,
    refRefresh:"Обновить",
    withdrawTitle:"Вывод токенов", withdrawWalletPlaceholder:"TON-кошелёк для получения",
    withdrawAmountPlaceholder:"Количество FAHHHH", withdrawBtn:"Отправить заявку",
    withdrawSent:"Заявка отправлена! Ожидай сообщения.", withdrawNote:"Обработка вручную, обычно до 24 ч.",
    earnItems:[
      { title:"Тапай монету",          desc:`Нажимай на большую монету — каждый тап приносит +${PER_TAP} FAHHHH.` },
      { title:"Следи за энергией",     desc:"Каждый тап тратит 1 энергию. Максимум 1000. С нуля восстанавливается за 30 минут." },
      { title:"Буст — перезарядка",    desc:"Мгновенно восстанавливает всю энергию. Максимум 2 буста в день." },
      { title:"Бонус холдера",         desc:"Держишь FAHHHH? Проверь кошелёк в разделе Обмен — получишь +1000 к максимуму энергии на 30 минут." },
      { title:"Рефералы",              desc:"Пригласи друга по своей ссылке (раздел Обмен) — получишь x2 на все тапы на 30 минут. Каждый реферал добавляет ещё +30 мин." },
      { title:"Лиги и прогресс",       desc:"Баланс → лига: Bronze → Silver → Gold → Platinum → Diamond." },
      { title:"Реальный токен TON",    desc:"FAHHHH — настоящий jetton-токен. Обменяй на STON.fi или DeDust." },
    ],
  },
  en: {
    leagueLabel: n => n + " League",
    until: (name, val) => val.toFixed(2) + " to " + name,
    taps: n => n.toLocaleString() + " taps · +" + PER_TAP + " per tap",
    boost:"Boost", tapBtn:"Tap",
    exchangeTitle:"FAHHHH", exchangeSub:"Token on the TON blockchain",
    perTap:"+" + PER_TAP + " FAHHHH per tap", yourBalance:"Your balance",
    contract:"Contract address", copy:"Copy", copied:"Copied", buyOn:"Buy / swap",
    earnTitle:"How to earn", earnSub:"Everything you need to know",
    checkHolder:"Check holdings", checkBtn:"Check",
    isHolder:"FAHHHH Holder", notHolder:"Not a holder", noToken:"No FAHHHH on this wallet",
    holderBoostBtn:"Activate bonus (+1000 energy for 30 min)", holderBoostDone:"Bonus activated! ⚡",
    refTitle:"Invite a friend", refDesc:"Each referral gives you x2 bonus for 30 min (stacks)",
    refLinkLabel:"Your referral link", refBoostActive: n => `⚡ x2 active · ${n} min`,
    refCopy:"Copy link", refCopied:"Copied!",
    refShareText:"Tap and earn FAHHHH with me!",
    refShareBtn:"Share", refShareDone:"Shared!",
    refYours:"Your referrals", refNone:"Nobody yet — share your link!",
    refCount: n => `${n} referral${n===1?"":"s"}`,
    refRefresh:"Refresh",
    withdrawTitle:"Withdraw tokens", withdrawWalletPlaceholder:"TON wallet address",
    withdrawAmountPlaceholder:"Amount of FAHHHH", withdrawBtn:"Submit request",
    withdrawSent:"Request sent! Await a message.", withdrawNote:"Processed manually, usually within 24h.",
    earnItems:[
      { title:"Tap the coin",           desc:`Press the big coin — each tap gives +${PER_TAP} FAHHHH.` },
      { title:"Watch your energy",      desc:"Each tap costs 1 energy. Max 1000. Refills from zero in 30 minutes." },
      { title:"Boost — instant refill", desc:"Instantly restores all energy. Max 2 boosts per day." },
      { title:"Holder bonus",           desc:"Hold FAHHHH? Check your wallet in Exchange — get +1000 max energy for 30 min." },
      { title:"Referrals",              desc:"Share your link (Exchange tab) — get x2 on all taps for 30 min. Every referral adds another +30 min." },
      { title:"Leagues & progress",     desc:"Balance → league: Bronze → Silver → Gold → Platinum → Diamond." },
      { title:"Real TON token",         desc:"FAHHHH is a real jetton token. Trade on STON.fi or DeDust." },
    ],
  },
  zh: {
    leagueLabel: n => n + " 联赛",
    until: (name, val) => "距" + name + " " + val.toFixed(2),
    taps: n => n.toLocaleString() + " 次 · +" + PER_TAP + "/次",
    boost:"加速", tapBtn:"点击",
    exchangeTitle:"FAHHHH", exchangeSub:"TON区块链代币",
    perTap:"每次 +" + PER_TAP + " FAHHHH", yourBalance:"我的余额",
    contract:"合约地址", copy:"复制", copied:"已复制", buyOn:"购买 / 兑换",
    earnTitle:"如何赚取", earnSub:"游戏说明",
    checkHolder:"查询持仓", checkBtn:"查询",
    isHolder:"FAHHHH持有者", notHolder:"非持有者", noToken:"此钱包无FAHHHH",
    holderBoostBtn:"激活奖励 (+1000能量30分钟)", holderBoostDone:"奖励已激活！⚡",
    refTitle:"邀请好友", refDesc:"每位推荐人给你30分钟x2奖励（可叠加）",
    refLinkLabel:"你的推荐链接", refBoostActive: n => `⚡ x2激活 · ${n}分钟`,
    refCopy:"复制链接", refCopied:"已复制！",
    refShareText:"和我一起点击赚取FAHHHH！",
    refShareBtn:"分享", refShareDone:"已分享！",
    refYours:"你的推荐", refNone:"暂无推荐 — 分享你的链接！",
    refCount: n => `${n} 位推荐`,
    refRefresh:"刷新",
    withdrawTitle:"提取代币", withdrawWalletPlaceholder:"TON钱包地址",
    withdrawAmountPlaceholder:"FAHHHH数量", withdrawBtn:"提交申请",
    withdrawSent:"申请已提交！", withdrawNote:"人工处理，通常24小时内。",
    earnItems:[
      { title:"点击金币",      desc:`每次点击获得 +${PER_TAP} FAHHHH。` },
      { title:"注意能量",      desc:"每次消耗1能量，上限1000，从零恢复需30分钟。" },
      { title:"加速",          desc:"立即回满能量。每天最多2次。" },
      { title:"持有者奖励",    desc:"持有FAHHHH？在交易页验证钱包，获得+1000最大能量（30分钟）。" },
      { title:"推荐好友",      desc:"分享你的推荐链接（交易页）— 获得30分钟x2点击奖励。每位推荐再加+30分钟。" },
      { title:"联赛",          desc:"余额决定联赛：铜→银→金→铂金→钻石。" },
      { title:"真实TON代币",   desc:"FAHHHH是真实jetton，可在STON.fi或DeDust交易。" },
    ],
  },
  ar: {
    leagueLabel: n => "دوري " + n,
    until: (name, val) => val.toFixed(2) + " حتى " + name,
    taps: n => n.toLocaleString() + " نقرة · +" + PER_TAP,
    boost:"تعزيز", tapBtn:"انقر",
    exchangeTitle:"FAHHHH", exchangeSub:"رمز على TON",
    perTap:"+" + PER_TAP + " لكل نقرة", yourBalance:"رصيدك",
    contract:"عنوان العقد", copy:"نسخ", copied:"تم النسخ", buyOn:"شراء / تبادل",
    earnTitle:"كيف تكسب", earnSub:"شرح اللعبة",
    checkHolder:"التحقق من الحيازة", checkBtn:"تحقق",
    isHolder:"حامل FAHHHH", notHolder:"ليس حاملاً", noToken:"لا يوجد FAHHHH في هذه المحفظة",
    holderBoostBtn:"تفعيل المكافأة (+1000 طاقة لمدة 30 دقيقة)", holderBoostDone:"تم تفعيل المكافأة! ⚡",
    refTitle:"ادعُ صديقاً", refDesc:"كل إحالة تمنحك مكافأة x2 لمدة 30 دقيقة (تتراكم)",
    refLinkLabel:"رابط الإحالة الخاص بك", refBoostActive: n => `⚡ x2 نشط · ${n} دقيقة`,
    refCopy:"نسخ الرابط", refCopied:"تم النسخ!",
    refShareText:"انقر واكسب FAHHHH معي!",
    refShareBtn:"مشاركة", refShareDone:"تمت المشاركة!",
    refYours:"إحالاتك", refNone:"لا أحد بعد — شارك رابطك!",
    refCount: n => `${n} إحالة`,
    refRefresh:"تحديث",
    withdrawTitle:"سحب الرموز", withdrawWalletPlaceholder:"محفظة TON",
    withdrawAmountPlaceholder:"كمية FAHHHH", withdrawBtn:"إرسال الطلب",
    withdrawSent:"تم إرسال الطلب!", withdrawNote:"معالجة يدوية، خلال 24 ساعة.",
    earnItems:[
      { title:"انقر العملة",    desc:`كل نقرة تمنحك +${PER_TAP} FAHHHH.` },
      { title:"راقب الطاقة",    desc:"كل نقرة تستهلك 1 طاقة. الحد 1000. تُستعاد من الصفر في 30 دقيقة." },
      { title:"تعزيز",          desc:"يستعيد الطاقة كاملة فوراً. الحد مرتان يومياً." },
      { title:"مكافأة الحامل",  desc:"تحمل FAHHHH؟ تحقق من محفظتك في التبادل واحصل على +1000 طاقة لمدة 30 دقيقة." },
      { title:"الإحالات",       desc:"شارك رابطك (صفحة التبادل) — احصل على x2 لجميع النقرات لمدة 30 دقيقة. كل إحالة تضيف +30 دقيقة." },
      { title:"الدوريات",       desc:"برونز → فضة → ذهب → بلاتين → ألماس." },
      { title:"رمز TON حقيقي",  desc:"FAHHHH رمز حقيقي. تداوله على STON.fi أو DeDust." },
    ],
  },
  hi: {
    leagueLabel: n => n + " लीग",
    until: (name, val) => name + " तक " + val.toFixed(2),
    taps: n => n.toLocaleString() + " टैप · +" + PER_TAP,
    boost:"बूस्ट", tapBtn:"टैप करें",
    exchangeTitle:"FAHHHH", exchangeSub:"TON ब्लॉकचेन टोकन",
    perTap:"+" + PER_TAP + " प्रति टैप", yourBalance:"आपका बैलेंस",
    contract:"कॉन्ट्रैक्ट पता", copy:"कॉपी", copied:"कॉपी हो गया", buyOn:"खरीदें / स्वैप",
    earnTitle:"कैसे कमाएं", earnSub:"गेम की जानकारी",
    checkHolder:"होल्डिंग जांचें", checkBtn:"जांचें",
    isHolder:"FAHHHH होल्डर", notHolder:"होल्डर नहीं", noToken:"इस वॉलेट में FAHHHH नहीं",
    holderBoostBtn:"बोनस सक्रिय करें (+1000 ऊर्जा 30 मिनट)", holderBoostDone:"बोनस सक्रिय! ⚡",
    refTitle:"दोस्त को आमंत्रित करें", refDesc:"हर रेफरल पर 30 मिनट x2 बोनस (जुड़ता है)",
    refLinkLabel:"आपका रेफरल लिंक", refBoostActive: n => `⚡ x2 एक्टिव · ${n} मिनट`,
    refCopy:"लिंक कॉपी करें", refCopied:"कॉपी हो गया!",
    refShareText:"मेरे साथ टैप करें और FAHHHH कमाएं!",
    refShareBtn:"शेयर करें", refShareDone:"शेयर हो गया!",
    refYours:"आपके रेफरल", refNone:"अभी कोई नहीं — लिंक शेयर करें!",
    refCount: n => `${n} रेफरल`,
    refRefresh:"रीफ्रेश",
    withdrawTitle:"टोकन निकालें", withdrawWalletPlaceholder:"TON वॉलेट पता",
    withdrawAmountPlaceholder:"FAHHHH की संख्या", withdrawBtn:"अनुरोध भेजें",
    withdrawSent:"अनुरोध भेजा गया!", withdrawNote:"24 घंटे के भीतर मैन्युअल प्रोसेसिंग।",
    earnItems:[
      { title:"सिक्के पर टैप",   desc:`हर टैप से +${PER_TAP} FAHHHH मिलते हैं।` },
      { title:"एनर्जी देखें",    desc:"हर टैप 1 एनर्जी खर्च करता है। मैक्स 1000। शून्य से 30 मिनट में भरती है।" },
      { title:"बूस्ट",           desc:"एनर्जी तुरंत पूरी हो जाती है। दिन में अधिकतम 2 बार।" },
      { title:"होल्डर बोनस",     desc:"FAHHHH होल्ड करते हैं? Exchange में चेक करें — 30 मिनट के लिए +1000 एनर्जी।" },
      { title:"रेफरल",           desc:"अपना लिंक शेयर करें (Exchange टैब) — 30 मिनट x2 टैप बोनस। हर रेफरल +30 मिनट जोड़ता है।" },
      { title:"लीग",             desc:"Bronze → Silver → Gold → Platinum → Diamond।" },
      { title:"TON टोकन",        desc:"FAHHHH असली जेटन टोकन है।" },
    ],
  },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

/* ── localStorage helpers ──────────────────────────────── */
const LS = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

/* ── Exchange Tab ──────────────────────────────────────── */
function ExchangeTab({ balance, copied, onCopy, t, userId, userName, onHolderBoost, holderBoostUntil, onWithdraw }) {
  const [wallet,       setWallet]       = useState("");
  const [checking,     setChecking]     = useState(false);
  const [result,       setResult]       = useState(null);
  const [boostUsed,    setBoostUsed]    = useState(false);
  const [wdWallet,     setWdWallet]     = useState("");
  const [wdAmount,     setWdAmount]     = useState("");
  const [wdSending,    setWdSending]    = useState(false);
  const [wdSent,       setWdSent]       = useState(false);

  const boostActive = holderBoostUntil > Date.now();
  const boostMinsLeft = boostActive ? Math.ceil((holderBoostUntil - Date.now()) / 60000) : 0;

  const submitWithdraw = async () => {
    const amt = parseFloat(wdAmount);
    if (!wdWallet.trim() || !amt || amt <= 0 || amt > balance) return;
    setWdSending(true);
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 5000);
    try {
      await fetch(`${API_URL}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wdWallet.trim(), amount: amt, userId, name: userName, balance }),
        signal: ctrl.signal,
      });
      setWdSent(true);
      onWithdraw(amt);
      setWdWallet(""); setWdAmount("");
    } catch {}
    finally { clearTimeout(tid); }
    setWdSending(false);
  };

  const checkHolder = async () => {
    const addr = wallet.trim();
    if (!addr) return;
    setChecking(true); setResult(null);
    try {
      const url = `https://tonapi.io/v2/accounts/${encodeURIComponent(addr)}/jettons/${encodeURIComponent(CONTRACT)}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (res.status === 404) { setResult({ isHolder: false, amount: 0 }); }
      else if (res.ok) {
        const data = await res.json();
        const decimals = data.jetton?.decimals ?? 9;
        const amount = parseFloat(data.balance || "0") / Math.pow(10, decimals);
        setResult({ isHolder: amount > 0, amount });
      } else { throw new Error("API " + res.status); }
    } catch (e) {
      setResult({ error: e.message?.includes("fetch") ? "Не удалось подключиться к TON API" : e.message });
    }
    setChecking(false);
  };

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 20px 8px" }}>
      <div style={{ background:"rgba(255,214,0,0.07)", border:"1px solid rgba(255,214,0,0.2)",
        borderRadius:20, padding:"20px", marginBottom:16, textAlign:"center" }}>
        <svg width="60" height="60" viewBox="0 0 60 60" style={{ marginBottom:10 }}>
          <defs><radialGradient id="tc" cx="33%" cy="27%" r="75%">
            <stop offset="0%" stopColor="#FFF9C4"/><stop offset="45%" stopColor="#FFD600"/>
            <stop offset="100%" stopColor="#E65100"/>
          </radialGradient></defs>
          <circle cx="30" cy="30" r="29" fill="url(#tc)"/>
          <circle cx="23" cy="27" r="4" fill="#5D3A00"/><circle cx="37" cy="27" r="4" fill="#5D3A00"/>
          <line x1="23" y1="38" x2="37" y2="38" stroke="#5D3A00" strokeWidth="3" strokeLinecap="round"/>
        </svg>
        <div style={{ fontSize:26, fontWeight:900 }}>{t.exchangeTitle}</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginTop:4 }}>{t.exchangeSub}</div>
        <div style={{ display:"inline-block", marginTop:12, background:"rgba(255,214,0,0.15)",
          border:"1px solid rgba(255,214,0,0.3)", borderRadius:10, padding:"6px 14px",
          fontSize:13, fontWeight:700, color:"#FFD600" }}>{t.perTap}</div>
      </div>

      <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:16, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase",
          letterSpacing:"0.12em", marginBottom:6 }}>{t.yourBalance}</div>
        <div style={{ fontSize:28, fontWeight:900 }}>
          {balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
          <span style={{ fontSize:16, color:"rgba(255,255,255,0.5)", marginLeft:8 }}>FAHHHH</span>
        </div>
      </div>

      <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:16, padding:"14px 16px", marginBottom:12 }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase",
          letterSpacing:"0.12em", marginBottom:8 }}>{t.contract}</div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <code style={{ fontFamily:"monospace", fontSize:12, color:"rgba(255,255,255,0.7)", flex:1, wordBreak:"break-all" }}>
            {CONTRACT.slice(0,12)}…{CONTRACT.slice(-10)}
          </code>
          <button onClick={onCopy} style={{
            background: copied ? "rgba(46,168,79,0.2)" : "rgba(255,255,255,0.08)",
            border:`1px solid ${copied ? "rgba(46,168,79,0.4)" : "rgba(255,255,255,0.12)"}`,
            borderRadius:10, padding:"8px 12px", cursor:"pointer",
            color: copied ? "#2EA84F" : "#fff",
            display:"flex", alignItems:"center", gap:6, fontSize:13, fontWeight:700, fontFamily:"inherit",
          }}>
            {copied ? <Check size={14}/> : <Copy size={14}/>}
            {copied ? t.copied : t.copy}
          </button>
        </div>
      </div>

      <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase",
        letterSpacing:"0.12em", marginBottom:10 }}>{t.buyOn}</div>
      {[
        { name:"STON.fi",   url:`https://app.ston.fi/swap?ft=TON&tt=${CONTRACT}`, color:"#6C63FF" },
        { name:"DeDust.io", url:`https://dedust.io/swap/TON/${CONTRACT}`,         color:"#0FCBA1" },
        { name:"Tonviewer", url:`https://tonviewer.com/${CONTRACT}`,              color:"#0098EA" },
      ].map(link => (
        <a key={link.name} href={link.url} target="_blank" rel="noreferrer" style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:14, padding:"13px 16px", marginBottom:8, textDecoration:"none", color:"#fff",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:link.color }}/>
            <span style={{ fontWeight:700, fontSize:15 }}>{link.name}</span>
          </div>
          <ExternalLink size={15} color="rgba(255,255,255,0.35)"/>
        </a>
      ))}

      {/* Проверка холдинга */}
      <div style={{ marginTop:6, paddingBottom:8 }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase",
          letterSpacing:"0.12em", marginBottom:10 }}>{t.checkHolder}</div>
        <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
          borderRadius:16, padding:"14px 16px", marginBottom: result ? 10 : 0 }}>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:8 }}>
            Введи адрес TON-кошелька
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={wallet} onChange={e => { setWallet(e.target.value); setResult(null); }}
              onKeyDown={e => e.key==="Enter" && checkHolder()}
              placeholder="EQ..."
              style={{ flex:1, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:10, padding:"10px 12px", color:"#fff", fontSize:13,
                fontFamily:"monospace", outline:"none" }}/>
            <button onClick={checkHolder} disabled={checking || !wallet.trim()} style={{
              background: (checking||!wallet.trim()) ? "rgba(255,255,255,0.05)" : "linear-gradient(180deg,#FFE838,#FFA000)",
              border:"none", borderRadius:10, padding:"10px 16px",
              color: (checking||!wallet.trim()) ? "rgba(255,255,255,0.25)" : "#5C3A06",
              fontWeight:800, fontSize:13, cursor: (checking||!wallet.trim()) ? "default" : "pointer",
              fontFamily:"inherit", flexShrink:0, minWidth:80, transition:"all .2s",
            }}>
              {checking ? "..." : t.checkBtn}
            </button>
          </div>
        </div>
        {result && !result.error && (
          <div style={{ background: result.isHolder ? "rgba(52,211,153,0.08)" : "rgba(255,80,80,0.07)",
            border:`1px solid ${result.isHolder ? "rgba(52,211,153,0.3)" : "rgba(255,80,80,0.2)"}`,
            borderRadius:16, padding:"16px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:14 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", flexShrink:0,
                background: result.isHolder ? "rgba(52,211,153,0.15)" : "rgba(255,80,80,0.12)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:20, fontWeight:900, color: result.isHolder ? "#34D399" : "#FF6060" }}>
                {result.isHolder ? "✓" : "✗"}
              </div>
              <div>
                <div style={{ fontWeight:800, fontSize:15, color: result.isHolder ? "#34D399" : "#FF6060" }}>
                  {result.isHolder ? t.isHolder : t.notHolder}
                </div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:3 }}>
                  {result.isHolder
                    ? `Баланс: ${result.amount.toLocaleString("en-US",{maximumFractionDigits:4})} FAHHHH`
                    : t.noToken}
                </div>
              </div>
            </div>
            {result.isHolder && (
              <button onClick={() => { if (!boostUsed && !boostActive) { onHolderBoost(); setBoostUsed(true); } }}
                disabled={boostUsed || boostActive}
                style={{ marginTop:12, width:"100%", border:"none", borderRadius:12, padding:"11px",
                  background: (boostUsed || boostActive) ? "rgba(255,255,255,0.06)" : "linear-gradient(180deg,#4ADE80,#22C55E)",
                  color: (boostUsed || boostActive) ? "rgba(255,255,255,0.4)" : "#fff",
                  fontWeight:800, fontSize:13, cursor: (boostUsed || boostActive) ? "default" : "pointer",
                  fontFamily:"inherit" }}>
                {(boostUsed || boostActive)
                  ? (boostActive ? `${t.holderBoostDone} (${boostMinsLeft} мин)` : t.holderBoostDone)
                  : t.holderBoostBtn}
              </button>
            )}
          </div>
        )}
        {result?.error && (
          <div style={{ background:"rgba(255,170,0,0.07)", border:"1px solid rgba(255,170,0,0.22)",
            borderRadius:16, padding:"14px 16px", display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18 }}>⚠</span>
            <span style={{ fontSize:13, color:"rgba(255,200,80,0.9)" }}>{result.error}</span>
          </div>
        )}
      </div>

      {/* ── Вывод токенов ── */}
      <div style={{ paddingBottom:16 }}>
        <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", textTransform:"uppercase",
          letterSpacing:"0.12em", marginBottom:10 }}>{t.withdrawTitle}</div>
        {wdSent ? (
          <div style={{ background:"rgba(52,211,153,0.08)", border:"1px solid rgba(52,211,153,0.3)",
            borderRadius:16, padding:"18px", textAlign:"center" }}>
            <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
            <div style={{ fontWeight:800, fontSize:15, color:"#34D399", marginBottom:4 }}>{t.withdrawSent}</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{t.withdrawNote}</div>
            <button onClick={() => setWdSent(false)} style={{ marginTop:12, background:"rgba(255,255,255,0.07)",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 16px",
              color:"rgba(255,255,255,0.6)", cursor:"pointer", fontFamily:"inherit", fontSize:12 }}>
              Новая заявка
            </button>
          </div>
        ) : (
          <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:16, padding:"14px 16px" }}>
            <input value={wdWallet} onChange={e => setWdWallet(e.target.value)}
              placeholder={t.withdrawWalletPlaceholder}
              style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:10, padding:"10px 12px", color:"#fff", fontSize:13, fontFamily:"monospace",
                outline:"none", marginBottom:8, boxSizing:"border-box" }}/>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input value={wdAmount} onChange={e => setWdAmount(e.target.value)} type="number"
                min="0.01" max={balance} step="0.01"
                placeholder={t.withdrawAmountPlaceholder}
                style={{ flex:1, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
                  borderRadius:10, padding:"10px 12px", color:"#fff", fontSize:13, fontFamily:"inherit",
                  outline:"none" }}/>
              <button onClick={() => setWdAmount(balance.toFixed(2))} style={{
                background:"rgba(255,214,0,0.1)", border:"1px solid rgba(255,214,0,0.25)",
                borderRadius:10, padding:"10px 12px", color:"#FFD600", fontWeight:800,
                fontSize:12, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>MAX</button>
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginBottom:10 }}>
              Доступно: {balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} FAHHHH
            </div>
            <button onClick={submitWithdraw}
              disabled={wdSending || !wdWallet.trim() || !parseFloat(wdAmount) || parseFloat(wdAmount) > balance}
              style={{ width:"100%", border:"none", borderRadius:12, padding:"13px",
                background: (!wdWallet.trim() || !parseFloat(wdAmount) || parseFloat(wdAmount) > balance)
                  ? "rgba(255,255,255,0.07)" : "linear-gradient(180deg,#FFE838,#FFA000)",
                color: (!wdWallet.trim() || !parseFloat(wdAmount) || parseFloat(wdAmount) > balance)
                  ? "rgba(255,255,255,0.25)" : "#5C3A06",
                fontWeight:900, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              {wdSending ? "..." : t.withdrawBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Earn Tab ──────────────────────────────────────────── */
const EARN_ICONS  = [Pickaxe, Zap, Rocket, Star, Users, Trophy, ArrowLeftRight];
const EARN_COLORS = ["#FFD600","#FFB800","#60A5FA","#34D399","#F472B6","#E879F9","#A78BFA"];

function EarnTab({ t }) {
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"20px 20px 8px" }}>
      <div style={{ fontSize:22, fontWeight:900, letterSpacing:"-0.02em", marginBottom:4 }}>{t.earnTitle}</div>
      <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginBottom:20 }}>{t.earnSub}</div>
      {t.earnItems.map(({ title, desc }, i) => {
        const Icon = EARN_ICONS[i]; const color = EARN_COLORS[i];
        return (
          <div key={i} style={{ display:"flex", gap:14, alignItems:"flex-start",
            background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
            borderRadius:16, padding:"14px 16px", marginBottom:10 }}>
            <div style={{ width:40, height:40, borderRadius:12, flexShrink:0,
              background:`${color}1A`, border:`1px solid ${color}40`,
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              <Icon size={18} color={color} strokeWidth={2.2}/>
            </div>
            <div>
              <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>{title}</div>
              <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.55 }}>{desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Leaderboard Tab ───────────────────────────────────── */
const MEDAL_COLORS = ["#FFD700","#C0C0C0","#CD7F32"];

function LeaderboardTab({ userId, userName, onSetName, currentBalance }) {
  const [entries,     setEntries]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [nameInput,   setNameInput]   = useState("");
  const [settingName, setSettingName] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const players = await dbGetLeaderboard();
    setEntries(players);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveNameAndSubmit = async () => {
    const n = nameInput.trim();
    if (!n) return;
    await onSetName(n);
    setSettingName(false);
  };

  const myRank = entries.findIndex(e => e.userId === userId) + 1;

  if (!userName) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
        justifyContent:"center", padding:"0 32px" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🏆</div>
        <div style={{ fontSize:20, fontWeight:900, marginBottom:8, textAlign:"center" }}>Введи своё имя</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", marginBottom:24, textAlign:"center" }}>
          Оно будет в таблице лидеров
        </div>
        <input value={nameInput} onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key==="Enter" && saveNameAndSubmit()}
          placeholder="Твоё имя..." maxLength={24} autoFocus
          style={{ width:"100%", background:"rgba(255,255,255,0.07)",
            border:"1px solid rgba(255,255,255,0.15)", borderRadius:14,
            padding:"14px 16px", color:"#fff", fontSize:16,
            fontFamily:"inherit", outline:"none", marginBottom:12, boxSizing:"border-box" }}/>
        <button onClick={saveNameAndSubmit} disabled={!nameInput.trim()} style={{
          width:"100%", background: nameInput.trim() ? "linear-gradient(180deg,#FFE838,#FFA000)" : "rgba(255,255,255,0.07)",
          border:"none", borderRadius:14, padding:"14px",
          color: nameInput.trim() ? "#5C3A06" : "rgba(255,255,255,0.3)",
          fontWeight:900, fontSize:16, cursor: nameInput.trim() ? "pointer" : "default",
          fontFamily:"inherit", transition:"all .2s" }}>
          Войти в топ
        </button>
      </div>
    );
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"14px 20px 10px", flexShrink:0 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:900 }}>Таблица лидеров</div>
          {lastRefresh && <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:2 }}>
            {lastRefresh.toLocaleTimeString()}
          </div>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => { setNameInput(userName); setSettingName(true); }} style={{
            background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)",
            borderRadius:10, padding:"8px 10px", cursor:"pointer", color:"rgba(255,255,255,0.6)",
            display:"flex", alignItems:"center", gap:5, fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
            <User size={13}/> {userName}
          </button>
          <button onClick={load} style={{ background:"rgba(255,255,255,0.07)",
            border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"8px 10px",
            cursor:"pointer", color:"rgba(255,255,255,0.6)", display:"flex", alignItems:"center" }}>
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }}/>
          </button>
        </div>
      </div>

      {myRank > 0 && (
        <div style={{ margin:"0 16px 10px", background:"rgba(255,214,0,0.08)",
          border:"1px solid rgba(255,214,0,0.25)", borderRadius:14, padding:"10px 14px",
          display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
          <span style={{ fontSize:13, color:"rgba(255,214,0,0.7)", fontWeight:700 }}>Ты:</span>
          <span style={{ fontWeight:900, color:"#FFD600" }}>#{myRank}</span>
          <span style={{ flex:1, fontWeight:700, fontSize:14 }}>{userName}</span>
          <span style={{ fontWeight:800, color:"#FFD600" }}>
            {currentBalance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </span>
        </div>
      )}

      {settingName && (
        <div style={{ margin:"0 16px 10px", background:"rgba(255,255,255,0.05)",
          border:"1px solid rgba(255,255,255,0.1)", borderRadius:14, padding:"12px 14px", flexShrink:0 }}>
          <div style={{ display:"flex", gap:8 }}>
            <input value={nameInput} onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && saveNameAndSubmit()}
              placeholder="Новое имя..." maxLength={24}
              style={{ flex:1, background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
                borderRadius:10, padding:"9px 12px", color:"#fff", fontSize:13, fontFamily:"inherit", outline:"none" }}/>
            <button onClick={saveNameAndSubmit} style={{ background:"linear-gradient(180deg,#FFE838,#FFA000)",
              border:"none", borderRadius:10, padding:"9px 14px", fontWeight:800, fontSize:13,
              color:"#5C3A06", cursor:"pointer", fontFamily:"inherit" }}>ОК</button>
            <button onClick={() => setSettingName(false)} style={{ background:"rgba(255,255,255,0.07)",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"9px 12px",
              color:"rgba(255,255,255,0.5)", cursor:"pointer", fontFamily:"inherit", fontSize:13 }}>✕</button>
          </div>
        </div>
      )}

      <div style={{ flex:1, overflowY:"auto", padding:"0 16px 12px" }}>
        {loading && entries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"rgba(255,255,255,0.3)" }}>Загрузка...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🏜️</div>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>Пока пусто</div>
            <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)" }}>Тапай — ты будешь первым!</div>
          </div>
        ) : entries.map((entry, i) => {
          const rank = i + 1;
          const isMe = entry.userId === userId;
          const medal = rank <= 3 ? MEDAL_COLORS[rank-1] : null;
          return (
            <div key={entry.userId} style={{ display:"flex", alignItems:"center", gap:12,
              background: isMe ? "rgba(255,214,0,0.1)" : i%2===0 ? "rgba(255,255,255,0.03)" : "transparent",
              border: isMe ? "1px solid rgba(255,214,0,0.3)" : "1px solid transparent",
              borderRadius:14, padding:"11px 14px", marginBottom:6 }}>
              <div style={{ width:32, textAlign:"center", flexShrink:0 }}>
                {medal ? <Medal size={20} color={medal} fill={medal} strokeWidth={1.5}/>
                       : <span style={{ fontSize:14, fontWeight:700, color:"rgba(255,255,255,0.4)" }}>{rank}</span>}
              </div>
              <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0,
                background: isMe ? "rgba(255,214,0,0.2)" : "rgba(255,255,255,0.08)",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:15, fontWeight:800, color: isMe ? "#FFD600" : "rgba(255,255,255,0.5)",
                border:`1px solid ${isMe ? "rgba(255,214,0,0.4)" : "rgba(255,255,255,0.1)"}` }}>
                {(entry.name||"?")[0].toUpperCase()}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight: isMe ? 800 : 700, fontSize:14,
                  color: isMe ? "#FFD600" : "#fff",
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {entry.name || "Anonymous"}{isMe ? " (ты)" : ""}
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
                  {(entry.taps||0).toLocaleString()} тапов
                </div>
              </div>
              <div style={{ fontWeight:900, fontSize:15, flexShrink:0,
                color: medal ? medal : isMe ? "#FFD600" : "rgba(255,255,255,0.85)" }}>
                {(entry.balance||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Friends Tab ───────────────────────────────────────── */
function FriendsTab({ userId, refBoostUntil, onRefBoostUpdate, t }) {
  const [referralList, setReferralList] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [shared,       setShared]       = useState(false);
  const [refCopied,    setRefCopied]    = useState(false);

  const refLink = BOT_USERNAME && userId
    ? `https://t.me/${BOT_USERNAME}?startapp=ref_${userId}`
    : null;

  const boostActive  = refBoostUntil > Date.now();
  const boostMinsLeft = boostActive ? Math.ceil((refBoostUntil - Date.now()) / 60000) : 0;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const data = await fetchRefData(userId);
    if (data.refBoostUntil > Date.now()) onRefBoostUpdate(data.refBoostUntil);
    setReferralList(data.referralList || []);
    setLoading(false);
  }, [userId, onRefBoostUpdate]);

  useEffect(() => { load(); }, [load]);

  const handleShare = useCallback(() => {
    if (!refLink) return;
    const text = t.refShareText;
    const tg = window.Telegram?.WebApp;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(shareUrl);
      setShared(true); setTimeout(() => setShared(false), 2000);
    } else if (navigator.share) {
      navigator.share({ title: "FAHHHH", text: text + "\n" + refLink }).catch(() => {});
      setShared(true); setTimeout(() => setShared(false), 2000);
    } else {
      navigator.clipboard?.writeText(text + "\n" + refLink).catch(() => {});
      setShared(true); setTimeout(() => setShared(false), 2000);
    }
  }, [refLink, t]);

  const handleCopy = useCallback(async () => {
    if (!refLink) return;
    try { await navigator.clipboard.writeText(refLink); } catch {
      const ta = document.createElement("textarea");
      ta.value = refLink; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setRefCopied(true); setTimeout(() => setRefCopied(false), 1500);
  }, [refLink]);

  const totalBalance = referralList.reduce((s, r) => s + (r.balance || 0), 0);

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"16px 16px 16px" }}>
      {/* Буст статус */}
      {boostActive && (
        <div style={{ background:"rgba(255,214,0,0.1)", border:"1px solid rgba(255,214,0,0.3)",
          borderRadius:14, padding:"12px 16px", marginBottom:14,
          display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:22 }}>⚡</span>
          <div>
            <div style={{ fontWeight:900, fontSize:15, color:"#FFD600" }}>x2 бонус активен</div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginTop:2 }}>
              {t.refBoostActive(boostMinsLeft)}
            </div>
          </div>
        </div>
      )}

      {/* Описание */}
      <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
        borderRadius:16, padding:"16px", marginBottom:14 }}>
        <div style={{ fontSize:16, fontWeight:900, marginBottom:6 }}>{t.refTitle}</div>
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", lineHeight:1.55 }}>{t.refDesc}</div>
      </div>

      {/* Share кнопка */}
      {refLink ? (
        <div style={{ marginBottom:14 }}>
          <button onClick={handleShare} style={{
            width:"100%", border:"none", borderRadius:14, padding:"15px",
            background: shared ? "rgba(52,211,153,0.2)" : "linear-gradient(180deg,#FFE838,#FFA000)",
            color: shared ? "#34D399" : "#5C3A06",
            fontWeight:900, fontSize:16, cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            marginBottom:8 }}>
            {shared ? "✓ " + t.refShareDone : "🔗 " + t.refShareBtn}
          </button>
          <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
            borderRadius:12, padding:"12px 14px",
            display:"flex", alignItems:"center", gap:8 }}>
            <code style={{ flex:1, fontSize:11, color:"rgba(255,255,255,0.55)",
              fontFamily:"monospace", wordBreak:"break-all" }}>
              {refLink}
            </code>
            <button onClick={handleCopy} style={{
              background: refCopied ? "rgba(46,168,79,0.2)" : "rgba(255,255,255,0.08)",
              border:`1px solid ${refCopied ? "rgba(46,168,79,0.4)" : "rgba(255,255,255,0.12)"}`,
              borderRadius:8, padding:"7px 10px", cursor:"pointer",
              color: refCopied ? "#2EA84F" : "#fff", fontFamily:"inherit",
              display:"flex", alignItems:"center", gap:4, fontSize:12, fontWeight:700, flexShrink:0 }}>
              {refCopied ? <Check size={12}/> : <Copy size={12}/>}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)",
          borderRadius:12, padding:"12px 14px", marginBottom:14,
          fontSize:12, color:"rgba(255,255,255,0.4)" }}>
          Твой реф-код: <code style={{ fontFamily:"monospace", color:"#FFD600" }}>ref_{userId}</code>
        </div>
      )}

      {/* Список рефералов */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800 }}>{t.refYours}</div>
          {referralList.length > 0 && (
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
              {t.refCount(referralList.length)} · {totalBalance.toLocaleString("en-US",{maximumFractionDigits:2})} FAHHHH total
            </div>
          )}
        </div>
        <button onClick={load} style={{ background:"rgba(255,255,255,0.07)",
          border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, padding:"7px 10px",
          cursor:"pointer", color:"rgba(255,255,255,0.6)", display:"flex", alignItems:"center", gap:5,
          fontFamily:"inherit", fontSize:12, fontWeight:700 }}>
          <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }}/>
          {t.refRefresh}
        </button>
      </div>

      {loading && referralList.length === 0 ? (
        <div style={{ textAlign:"center", padding:"30px 0", color:"rgba(255,255,255,0.3)", fontSize:13 }}>
          ...
        </div>
      ) : referralList.length === 0 ? (
        <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:14, padding:"24px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>👥</div>
          <div style={{ fontSize:14, color:"rgba(255,255,255,0.4)" }}>{t.refNone}</div>
        </div>
      ) : referralList.map((r, i) => (
        <div key={r.userId} style={{ display:"flex", alignItems:"center", gap:12,
          background: i%2===0 ? "rgba(255,255,255,0.03)" : "transparent",
          border:"1px solid rgba(255,255,255,0.06)",
          borderRadius:14, padding:"11px 14px", marginBottom:6 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0,
            background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.1)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:15, fontWeight:800, color:"rgba(255,255,255,0.5)" }}>
            {(r.name||"?")[0].toUpperCase()}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14,
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
              {r.name || "Anonymous"}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
              {(r.taps||0).toLocaleString()} тапов
            </div>
          </div>
          <div style={{ fontWeight:800, fontSize:14, flexShrink:0, color:"#FFD600" }}>
            {(r.balance||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Lang Modal ────────────────────────────────────────── */
function LangModal({ current, onSelect, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.75)",
      display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width:"100%", maxWidth:480,
        background:"#111", borderRadius:"20px 20px 0 0", padding:"8px 0 20px",
        border:"1px solid rgba(255,255,255,0.1)", borderBottom:"none" }}>
        <div style={{ width:36, height:4, borderRadius:99, background:"rgba(255,255,255,0.2)", margin:"10px auto 18px" }}/>
        {LANGUAGES.map(lang => (
          <button key={lang.code} onClick={() => { onSelect(lang.code); onClose(); }} style={{
            width:"100%", background: current===lang.code ? "rgba(255,214,0,0.1)" : "transparent",
            border:"none", borderBottom:"1px solid rgba(255,255,255,0.06)",
            padding:"14px 24px", cursor:"pointer", fontFamily:"inherit",
            display:"flex", alignItems:"center", gap:14, color:"#fff" }}>
            <span style={{ width:36, height:36, borderRadius:10, flexShrink:0,
              background: current===lang.code ? "rgba(255,214,0,0.15)" : "rgba(255,255,255,0.07)",
              border:`1px solid ${current===lang.code ? "rgba(255,214,0,0.4)" : "rgba(255,255,255,0.1)"}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:13, fontWeight:800,
              color: current===lang.code ? "#FFD600" : "rgba(255,255,255,0.6)" }}>
              {lang.short}
            </span>
            <span style={{ fontSize:16, fontWeight: current===lang.code ? 800 : 600 }}>{lang.label}</span>
            {current===lang.code && <Check size={16} color="#FFD600" style={{ marginLeft:"auto" }}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Main App ──────────────────────────────────────────── */
export default function App() {
  const [balance,          setBalance]          = useState(0);
  const [taps,             setTaps]             = useState(0);
  const [energy,           setEnergy]           = useState(() => {
    const saved = LS.get("fahhhh-energy", null);
    if (!saved?.savedAt) return MAX_ENERGY;
    const elapsed = (Date.now() - saved.savedAt) / 1000;
    return Math.min(MAX_ENERGY, (saved.value ?? MAX_ENERGY) + elapsed * MAX_ENERGY / 1800);
  });
  const [screaming,        setScreaming]        = useState(false);
  const [tab,              setTab]              = useState("mine");
  const [leagueIdx,        setLeagueIdx]        = useState(0);
  const [copied,           setCopied]           = useState(false);
  const [saved,            setSaved]            = useState(false);
  const [lang,             setLang]             = useState("ru");
  const [showLang,         setShowLang]         = useState(false);
  const [userId,           setUserId]           = useState("");
  const [userName,         setUserName]         = useState("");
  const [holderBoostUntil, setHolderBoostUntil] = useState(() => {
    const v = LS.get("fahhhh-holder-boost", 0);
    return v > Date.now() ? v : 0;
  });
  const [boostToday, setBoostToday] = useState(() => {
    const v = LS.get("fahhhh-boost-info", { count: 0, day: "" });
    return v.day === todayISO() ? v : { count: 0, day: todayISO() };
  });
  const [refBoostUntil, setRefBoostUntil] = useState(() => {
    const v = LS.get("fahhhh-ref-boost", 0);
    return v > Date.now() ? v : 0;
  });

  const audioPool        = useRef([]);
  const poolIdx          = useRef(0);
  const saveTimer        = useRef(null);
  const screamTimer      = useRef(null);
  const submitTimer      = useRef(null);
  const coinRef          = useRef(null);
  const tiltTimer        = useRef(null);
  const floatContainerRef = useRef(null);
  const screamingRef     = useRef(false);
  const maxEnergyRef     = useRef(MAX_ENERGY);
  const energyRef        = useRef(energy);
  const tapValueRef      = useRef(PER_TAP);

  const maxEnergy = holderBoostUntil > Date.now() ? HOLDER_MAX_ENERGY : MAX_ENERGY;
  maxEnergyRef.current = maxEnergy;
  energyRef.current = energy;
  const tapValue = refBoostUntil > Date.now() ? +(PER_TAP * 2).toFixed(2) : PER_TAP;
  tapValueRef.current = tapValue;

  const t = T[lang] || T.ru;

  /* ── загрузка из localStorage ── */
  useEffect(() => {
    const data = LS.get("fahhhh-progress", {});
    if (data.balance) setBalance(data.balance);
    if (data.taps)    setTaps(data.taps);
    if (data.lang)    setLang(data.lang);
  }, []);

  /* ── сохранение ── */
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      LS.set("fahhhh-progress", { balance, taps, lang });
      setSaved(true);
      setTimeout(() => setSaved(false), 1600);
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [balance, taps, lang]);

  /* ── лига ── */
  useEffect(() => {
    let idx = 0;
    for (let i = 0; i < LEAGUES.length; i++) if (balance >= LEAGUES[i].min) idx = i;
    setLeagueIdx(idx);
  }, [balance]);

  /* ── энергия ── */
  useEffect(() => {
    const t = setInterval(() => setEnergy(e => Math.min(maxEnergyRef.current, e + maxEnergyRef.current / 1800)), 1000);
    return () => clearInterval(t);
  }, []);

  /* ── истечение реф-буста ── */
  useEffect(() => {
    if (!refBoostUntil) return;
    const remaining = refBoostUntil - Date.now();
    if (remaining <= 0) { setRefBoostUntil(0); return; }
    const tid = setTimeout(() => { setRefBoostUntil(0); LS.set("fahhhh-ref-boost", 0); }, remaining);
    return () => clearTimeout(tid);
  }, [refBoostUntil]);

  /* ── сохранение энергии ── */
  useEffect(() => {
    const save = () => LS.set("fahhhh-energy", { value: energyRef.current, savedAt: Date.now() });
    const tid = setInterval(save, 30000);
    document.addEventListener("visibilitychange", save);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(tid);
      document.removeEventListener("visibilitychange", save);
      window.removeEventListener("pagehide", save);
    };
  }, []);

  /* ── истечение буста холдера ── */
  useEffect(() => {
    if (!holderBoostUntil) return;
    const remaining = holderBoostUntil - Date.now();
    if (remaining <= 0) { setHolderBoostUntil(0); return; }
    const tid = setTimeout(() => {
      setHolderBoostUntil(0);
      LS.set("fahhhh-holder-boost", 0);
      setEnergy(e => Math.min(e, MAX_ENERGY));
    }, remaining);
    return () => clearTimeout(tid);
  }, [holderBoostUntil]);

  /* ── аудио ── */
  useEffect(() => {
    try {
      audioPool.current = Array.from({ length: 6 }, () => {
        const a = new Audio(FAAAH_SRC);
        a.preload = "auto"; a.volume = 0.95;
        return a;
      });
    } catch {}
  }, []);

  const playSound = useCallback(() => {
    const pool = audioPool.current;
    if (!pool.length) return;
    const a = pool[poolIdx.current++ % pool.length];
    try { a.currentTime = 0; a.play().catch(() => {}); } catch {}
  }, []);

  /* ── идентификация пользователя ── */
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    const tgUser = tg?.initDataUnsafe?.user;
    if (tgUser?.id) {
      setUserId(String(tgUser.id));
      setUserName(tgUser.first_name || tgUser.username || "Player");
      return;
    }
    const stored = LS.get("fahhhh-uid", null);
    if (stored?.id) { setUserId(stored.id); setUserName(stored.name || ""); return; }
    const id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
    LS.set("fahhhh-uid", { id, name: "" });
    setUserId(id);
  }, []);

  /* ── реферальная система ── */
  useEffect(() => {
    if (!userId) return;
    // Проверяем серверный буст
    fetchRefData(userId).then(({ refBoostUntil: serverUntil }) => {
      if (serverUntil > Date.now()) {
        setRefBoostUntil(serverUntil);
        LS.set("fahhhh-ref-boost", serverUntil);
      }
    });
    // Обрабатываем входящий реферал
    const startParam = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
    if (startParam.startsWith("ref_")) {
      const referrerId = startParam.slice(4);
      if (referrerId && referrerId !== userId && !LS.get("fahhhh-referred-by", null)) {
        LS.set("fahhhh-referred-by", referrerId);
        sendReferral(referrerId, userId, window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "")
          .then(serverUntil => {
            if (serverUntil > Date.now()) {
              setRefBoostUntil(serverUntil);
              LS.set("fahhhh-ref-boost", serverUntil);
            }
          });
      }
    }
  }, [userId]);

  /* ── отправка в лидерборд ── */
  useEffect(() => {
    if (!userId || balance <= 0 || !userName) return;
    clearTimeout(submitTimer.current);
    submitTimer.current = setTimeout(() => {
      dbSetScore({ userId, name: userName, balance, taps, lang });
    }, 2000);
    return () => clearTimeout(submitTimer.current);
  }, [balance, taps, userId, userName]);

  const handleSetName = useCallback(async (name) => {
    setUserName(name);
    LS.set("fahhhh-uid", { id: userId, name });
    dbSetScore({ userId, name, balance, taps, lang });
  }, [userId, balance, taps, lang]);

  const handleHolderBoost = useCallback(() => {
    const expiry = Date.now() + HOLDER_BOOST_MS;
    setHolderBoostUntil(expiry);
    LS.set("fahhhh-holder-boost", expiry);
    setEnergy(HOLDER_MAX_ENERGY);
  }, []);

  const boostsLeft = boostToday.day === todayISO() ? Math.max(0, 2 - boostToday.count) : 2;

  const handleBoost = useCallback(() => {
    const today = todayISO();
    const currentCount = boostToday.day === today ? boostToday.count : 0;
    if (currentCount >= 2) return;
    const updated = { count: currentCount + 1, day: today };
    setBoostToday(updated);
    LS.set("fahhhh-boost-info", updated);
    setEnergy(maxEnergyRef.current);
  }, [boostToday]);

  /* ── прямой DOM: плавающий "+N" ── */
  const spawnFloat = useCallback((x, y, val) => {
    const c = floatContainerRef.current;
    if (!c) return;
    if (c.children.length >= 6) c.removeChild(c.firstChild);
    const el = document.createElement("span");
    el.textContent = "+" + val;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);` +
      `font-weight:900;font-size:28px;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.75);` +
      `animation:floatUp .9s ease-out forwards;pointer-events:none;white-space:nowrap;font-family:inherit;`;
    c.appendChild(el);
    setTimeout(() => { try { c.removeChild(el); } catch {} }, 950);
  }, []);

  /* ── тап ── */
  const handleTap = useCallback((e) => {
    if (energyRef.current < 1) return;
    const tv = tapValueRef.current;
    playSound();
    setBalance(b => +(b + tv).toFixed(2));
    setTaps(t => t + 1);
    setEnergy(en => Math.max(0, en - 1));

    const rect = coinRef.current?.getBoundingClientRect();
    const cx = e.touches?.[0]?.clientX ?? e.clientX;
    const cy = e.touches?.[0]?.clientY ?? e.clientY;
    const x  = rect ? cx - rect.left  : 145;
    const y  = rect ? cy - rect.top   : 145;
    const dx = rect ? (x - rect.width/2)  / (rect.width/2)  : 0;
    const dy = rect ? (y - rect.height/2) / (rect.height/2) : 0;

    // Тилт — прямой DOM через CSS custom property (React не перезапишет)
    coinRef.current?.style.setProperty("--cx", `${-dy * 18}deg`);
    coinRef.current?.style.setProperty("--cy", `${dx * 18}deg`);
    clearTimeout(tiltTimer.current);
    tiltTimer.current = setTimeout(() => {
      coinRef.current?.style.setProperty("--cx", "0deg");
      coinRef.current?.style.setProperty("--cy", "0deg");
    }, 130);

    if (!screamingRef.current) {
      screamingRef.current = true;
      setScreaming(true);
    }
    clearTimeout(screamTimer.current);
    screamTimer.current = setTimeout(() => {
      screamingRef.current = false;
      setScreaming(false);
    }, SCREAM_MS);

    // Флоат — прямой DOM, без React state
    spawnFloat(x, y, tv);
  }, [playSound, spawnFloat]);

  const copyContract = async () => {
    try { await navigator.clipboard.writeText(CONTRACT); } catch {
      const ta = document.createElement("textarea");
      ta.value = CONTRACT; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const league    = LEAGUES[leagueIdx];
  const nextL     = LEAGUES[leagueIdx + 1];
  const lgPct     = nextL ? Math.min(100, ((balance - league.min) / (nextL.min - league.min)) * 100) : 100;
  const energyPct = (energy / maxEnergy) * 100;
  const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  const LangBtn = () => (
    <button onClick={() => setShowLang(true)} style={{
      background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.11)",
      borderRadius:10, padding:"6px 10px", display:"flex", alignItems:"center", gap:5,
      cursor:"pointer", color:"rgba(255,255,255,0.75)", fontFamily:"inherit",
      fontWeight:800, fontSize:13, width:64, justifyContent:"center" }}>
      <Globe size={13} color="rgba(255,255,255,0.45)" strokeWidth={2}/>
      {currentLang.short}
      <ChevronDown size={11} color="rgba(255,255,255,0.35)"/>
    </button>
  );

  return (
    <div style={{ height:"100vh", maxHeight:"100vh", background:"#000", color:"#fff",
      fontFamily:"'Nunito','SF Pro Rounded',-apple-system,sans-serif",
      display:"flex", flexDirection:"column", overflow:"hidden",
      userSelect:"none", WebkitTapHighlightColor:"transparent", touchAction:"none",
      direction: lang==="ar" ? "rtl" : "ltr" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        @keyframes floatUp { 0%{opacity:1;transform:translate(-50%,-50%) scale(1.1)} 100%{opacity:0;transform:translate(-50%,-210px) scale(1)} }
        @keyframes coinShake { 0%,100%{transform:translateX(0) rotate(0deg)} 15%{transform:translateX(-4px) rotate(-1.5deg)} 30%{transform:translateX(4px) rotate(1.5deg)} 45%{transform:translateX(-3px) rotate(-1deg)} 60%{transform:translateX(3px) rotate(1deg)} 75%{transform:translateX(-2px) rotate(-0.5deg)} 90%{transform:translateX(2px) rotate(0.5deg)} }
        @keyframes mouthBounce { 0%,100%{transform:scaleY(1) scaleX(1)} 30%{transform:scaleY(1.12) scaleX(1.04)} 70%{transform:scaleY(0.88) scaleX(0.96)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes toastPop { from{opacity:0;transform:translateX(-50%) scale(0.85) translateY(8px)} to{opacity:1;transform:translateX(-50%) scale(1) translateY(0)} }
        .coin-shake { animation: coinShake 0.18s linear infinite; }
        .mouth-bounce { animation: mouthBounce 0.18s ease-in-out infinite; }
        .coin-btn { transform: rotateX(var(--cx,0deg)) rotateY(var(--cy,0deg)); transition: transform 130ms ease; will-change: transform; }
        @media (prefers-reduced-motion:reduce) { *{animation:none!important;transition:none!important} }
      `}</style>

      {/* Mine: лига */}
      {tab === "mine" && (
        <>
          <div style={{ padding:"14px 20px 0" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <div style={{ width:64 }}/>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <button onClick={() => setLeagueIdx(i => Math.max(0,i-1))}
                  style={{ background:"none",border:"none",color:"rgba(255,255,255,0.35)",fontSize:22,cursor:"pointer",padding:"0 2px",fontFamily:"inherit" }}>‹</button>
                <Trophy size={16} color={league.color} strokeWidth={2.5}/>
                <span style={{ fontSize:15, fontWeight:800 }}>{t.leagueLabel(league.name)}</span>
                <button onClick={() => setLeagueIdx(i => Math.min(LEAGUES.length-1,i+1))}
                  style={{ background:"none",border:"none",color:"rgba(255,255,255,0.35)",fontSize:22,cursor:"pointer",padding:"0 2px",fontFamily:"inherit" }}>›</button>
              </div>
              <LangBtn/>
            </div>
            <div style={{ height:5,borderRadius:99,background:"rgba(255,255,255,0.1)",overflow:"hidden" }}>
              <div style={{ height:"100%",width:`${lgPct}%`,background:`linear-gradient(90deg,${league.color},${nextL?.color||league.color})`,borderRadius:99,transition:"width .5s ease" }}/>
            </div>
            {nextL && <div style={{ fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:5,textAlign:"center" }}>{t.until(nextL.name, Math.max(0,nextL.min-balance))}</div>}
          </div>
          <div style={{ textAlign:"center", padding:"10px 20px 0", flexShrink:0 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}>
              <svg width="38" height="38" viewBox="0 0 38 38">
                <defs><radialGradient id="gi" cx="35%" cy="28%" r="75%">
                  <stop offset="0%" stopColor="#FFF176"/><stop offset="45%" stopColor="#FFD600"/>
                  <stop offset="100%" stopColor="#E65100"/>
                </radialGradient></defs>
                <circle cx="19" cy="19" r="18" fill="url(#gi)"/>
                <circle cx="13" cy="17" r="2.5" fill="#5D3A00"/><circle cx="25" cy="17" r="2.5" fill="#5D3A00"/>
                <line x1="13" y1="24" x2="25" y2="24" stroke="#5D3A00" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize:46,fontWeight:900,letterSpacing:"-0.03em",fontVariantNumeric:"tabular-nums",lineHeight:1 }}>
                {balance.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}
              </span>
            </div>
            <div style={{ fontSize:12,color:"rgba(255,255,255,0.35)",marginTop:4 }}>{t.taps(taps)}</div>
            {refBoostUntil > Date.now() && (
              <div style={{ display:"inline-flex",alignItems:"center",gap:5,marginTop:6,
                background:"rgba(255,214,0,0.12)",border:"1px solid rgba(255,214,0,0.3)",
                borderRadius:99,padding:"4px 12px",fontSize:13,fontWeight:900,color:"#FFD600" }}>
                ⚡ x2 · {Math.ceil((refBoostUntil - Date.now()) / 60000)} мин
              </div>
            )}
          </div>
        </>
      )}

      {/* Шапка для не-Mine вкладок */}
      {tab !== "mine" && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end",
          padding:"14px 20px 4px", flexShrink:0 }}>
          <LangBtn/>
        </div>
      )}

      {/* Контент вкладок */}
      {tab === "exchange"    && <ExchangeTab balance={balance} copied={copied} onCopy={copyContract} t={t}
        userId={userId} userName={userName} onHolderBoost={handleHolderBoost} holderBoostUntil={holderBoostUntil}
        onWithdraw={amt => setBalance(b => +Math.max(0, b - amt).toFixed(2))}/>}
      {tab === "earn"        && <EarnTab t={t}/>}
      {tab === "leaderboard" && <LeaderboardTab userId={userId} userName={userName} onSetName={handleSetName} currentBalance={balance}/>}
      {tab === "friends"     && <FriendsTab userId={userId} refBoostUntil={refBoostUntil} t={t}
        onRefBoostUpdate={v => { setRefBoostUntil(v); LS.set("fahhhh-ref-boost", v); }}/>}

      {/* Монета */}
      {tab === "mine" && (
        <>
          <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",perspective:"900px",paddingBottom:4 }}>
            <button ref={coinRef} onPointerDown={handleTap} aria-label={t.tapBtn}
              className={`coin-btn${screaming ? " coin-shake" : ""}`}
              style={{
              width:"min(72vw,290px)", height:"min(72vw,290px)",
              borderRadius:"50%", border:"none", padding:0, cursor:"pointer",
              position:"relative", background:"none",
              touchAction:"manipulation",
              WebkitTapHighlightColor:"transparent" }}>
              <div style={{ position:"absolute",inset:-24,borderRadius:"50%",
                background: screaming ? "radial-gradient(circle,rgba(255,80,0,0.3) 0%,transparent 70%)" : "radial-gradient(circle,rgba(255,214,0,0.2) 0%,transparent 70%)",
                filter:"blur(18px)",pointerEvents:"none",transition:"background 0.2s" }}/>
              <svg viewBox="0 0 290 290" style={{ width:"100%",height:"100%",display:"block" }}>
                <defs>
                  <radialGradient id="gc" cx="32%" cy="26%" r="80%">
                    <stop offset="0%" stopColor="#FFF9C4"/><stop offset="20%" stopColor="#FFE838"/>
                    <stop offset="55%" stopColor="#FFD600"/><stop offset="80%" stopColor="#FFA000"/>
                    <stop offset="100%" stopColor="#E65100"/>
                  </radialGradient>
                  <radialGradient id="ri" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.12)"/>
                    <stop offset="100%" stopColor="rgba(0,0,0,0.08)"/>
                  </radialGradient>
                  <filter id="ds"><feDropShadow dx="0" dy="8" stdDeviation="18" floodColor="rgba(180,90,0,0.5)"/></filter>
                </defs>
                <circle cx="145" cy="145" r="140" fill="url(#gc)" filter="url(#ds)"/>
                <circle cx="145" cy="145" r="140" fill="url(#ri)"/>
                <circle cx="145" cy="145" r="128" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>
                <ellipse cx="112" cy="86" rx="46" ry="24" fill="rgba(255,255,255,0.3)" transform="rotate(-30 112 86)"/>
                <g style={{ transition:"opacity 0.08s", opacity: screaming ? 0 : 1 }}>
                  <circle cx="112" cy="130" r="14" fill="#5D3A00"/><circle cx="117" cy="125" r="5" fill="rgba(255,255,255,0.55)"/>
                  <circle cx="178" cy="130" r="14" fill="#5D3A00"/><circle cx="183" cy="125" r="5" fill="rgba(255,255,255,0.55)"/>
                </g>
                <g style={{ transition:"opacity 0.08s", opacity: screaming ? 1 : 0 }}>
                  <path d="M 96 116 Q 112 108 128 116" fill="none" stroke="#5D3A00" strokeWidth="7" strokeLinecap="round"/>
                  <path d="M 162 116 Q 178 108 194 116" fill="none" stroke="#5D3A00" strokeWidth="7" strokeLinecap="round"/>
                  <path d="M 98 132 Q 112 122 126 132 Q 112 140 98 132" fill="#5D3A00"/>
                  <path d="M 164 132 Q 178 122 192 132 Q 178 140 164 132" fill="#5D3A00"/>
                </g>
                <line x1="112" y1="180" x2="178" y2="180" stroke="#5D3A00" strokeWidth="7" strokeLinecap="round"
                  style={{ transition:"opacity 0.08s", opacity: screaming ? 0 : 1 }}/>
                <g className={screaming ? "mouth-bounce" : undefined}
                  style={{ transition:"opacity 0.08s", opacity: screaming ? 1 : 0 }}>
                  <ellipse cx="145" cy="192" rx="40" ry="30" fill="#1A0000"/>
                  <path d="M 105 178 Q 125 168 145 172 Q 165 168 185 178" fill="#8B4513"/>
                  <path d="M 105 178 Q 105 222 145 224 Q 185 222 185 178" fill="#A0522D"/>
                  <rect x="120" y="172" width="18" height="12" rx="3" fill="#F5F0E0"/>
                  <rect x="141" y="172" width="18" height="12" rx="3" fill="#F5F0E0"/>
                  <rect x="126" y="210" width="16" height="11" rx="3" fill="#F5F0E0"/>
                  <rect x="148" y="210" width="16" height="11" rx="3" fill="#F5F0E0"/>
                  <ellipse cx="145" cy="200" rx="22" ry="10" fill="#E8474C"/>
                </g>
                <text x="145" y="244" textAnchor="middle" fontSize="20" fontWeight="900"
                  fontFamily="Nunito,sans-serif" letterSpacing="3"
                  fill={screaming ? "#fff" : "rgba(93,58,0,0.7)"}
                  style={{ transition:"fill 0.1s" }}>FAHHHH</text>
              </svg>
              <div ref={floatContainerRef} style={{ position:"absolute",inset:0,pointerEvents:"none",overflow:"visible" }}/>
            </button>
          </div>
          <div style={{ padding:"0 24px 10px", flexShrink:0 }}>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
              <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                <Zap size={22} color="#FFD600" fill="#FFD600"/>
                <span style={{ fontSize:18,fontWeight:800,fontVariantNumeric:"tabular-nums" }}>
                  {Math.floor(energy)}<span style={{ color:"rgba(255,255,255,0.38)",fontWeight:600 }}>/{maxEnergy}</span>
                </span>
              </div>
              <button onClick={handleBoost} disabled={boostsLeft === 0} style={{
                background: boostsLeft === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
                border:`1px solid ${boostsLeft === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)"}`,
                borderRadius:14,padding:"9px 20px",
                color: boostsLeft === 0 ? "rgba(255,255,255,0.25)" : "#fff",
                fontWeight:800,fontSize:15,
                display:"flex",alignItems:"center",gap:7,
                cursor: boostsLeft === 0 ? "default" : "pointer",fontFamily:"inherit" }}>
                <Rocket size={16}/> {t.boost}
                <span style={{ fontSize:12,fontWeight:600,opacity:0.7 }}>({boostsLeft})</span>
              </button>
            </div>
            <div style={{ height:7,borderRadius:99,background:"rgba(255,255,255,0.1)",overflow:"hidden" }}>
              <div style={{ height:"100%",width:`${energyPct}%`,background:"linear-gradient(90deg,#FFA000,#FFD600)",borderRadius:99,transition:"width .4s ease" }}/>
            </div>
          </div>
        </>
      )}

      {/* Навигация */}
      <nav style={{ display:"flex",background:"rgba(255,255,255,0.04)",borderTop:"1px solid rgba(255,255,255,0.07)",flexShrink:0 }}>
        {[
          { id:"exchange",    Icon:ArrowLeftRight },
          { id:"mine",        Icon:Pickaxe        },
          { id:"earn",        Icon:BookOpen       },
          { id:"friends",     Icon:Users          },
          { id:"leaderboard", Icon:Medal          },
        ].map(({ id, Icon }) => {
          const active = id === tab;
          const label  = TABS_LABELS[id][lang];
          return (
            <button key={id} onClick={() => setTab(id)} style={{
              flex:1,border:"none",background:"none",padding:"10px 4px 12px",
              display:"flex",flexDirection:"column",alignItems:"center",gap:4,
              cursor:"pointer",fontFamily:"inherit",
              color: active ? "#FFD600" : "rgba(255,255,255,0.38)",
              transition:"color .15s", position:"relative" }}>
              {active && <div style={{ position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:28,height:2,borderRadius:99,background:"#FFD600" }}/>}
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8}/>
              <span style={{ fontSize:10,fontWeight:active?800:600,letterSpacing:0.2 }}>{label}</span>
            </button>
          );
        })}
      </nav>

      {/* Toast */}
      {saved && (
        <div style={{ position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",
          background:"rgba(34,197,94,0.92)",backdropFilter:"blur(8px)",
          borderRadius:99,padding:"9px 20px",fontSize:13,fontWeight:800,color:"#fff",
          zIndex:200,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.4)",
          animation:"toastPop 0.25s ease",pointerEvents:"none" }}>
          ✓ Прогресс сохранён
        </div>
      )}

      {/* Модалка языка */}
      {showLang && <LangModal current={lang} onSelect={setLang} onClose={() => setShowLang(false)}/>}
    </div>
  );
}
