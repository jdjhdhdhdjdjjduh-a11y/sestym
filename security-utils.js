// مسافة Levenshtein - تحسب كم حرف لازم تتغير عشان تحول كلمة لوحدة ثانية
// نستخدمها لكشف نطاقات شبيهة بأسماء مواقع مشهورة (d1scord.com بدل discord.com مثلاً)
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// أشهر النطاقات المستهدفة بالتصيد الاحتيالي بمجتمعات ديسكورد
const PROTECTED_BRANDS = [
  'discord.com', 'discord.gg', 'discordapp.com',
  'steamcommunity.com', 'steampowered.com',
  'roblox.com', 'paypal.com', 'google.com', 'twitch.tv'
];

// يرجع اسم البراند المقلّد لو الدومين يشبه وحد منهم بشكل مريب، أو false لو سليم
function findImpersonatedBrand(domain) {
  for (const brand of PROTECTED_BRANDS) {
    if (domain === brand || domain.endsWith('.' + brand)) return false; // نفس النطاق الحقيقي أو نطاق فرعي شرعي منه

    const distance = levenshtein(domain, brand);
    const closeEnough = distance > 0 && distance <= 2 && Math.abs(domain.length - brand.length) <= 3;
    if (closeEnough) return brand;
  }
  return false;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

module.exports = { levenshtein, findImpersonatedBrand, extractDomain };
