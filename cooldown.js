// خريطة بالذاكرة تحفظ آخر وقت استخدم فيه كل عضو أي أمر إداري
const lastUsed = new Map();
const COOLDOWN_MS = 3000; // 3 ثواني بين كل أمر وأمر لنفس العضو

// يرجع true لو العضو لسا بفترة الانتظار (يعني لازم نرفض الأمر)
function isOnCooldown(userId) {
  const last = lastUsed.get(userId);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

function setCooldown(userId) {
  lastUsed.set(userId, Date.now());
}

// كم ثانية باقية (للعرض بالرسالة)
function remainingSeconds(userId) {
  const last = lastUsed.get(userId) || 0;
  const remaining = COOLDOWN_MS - (Date.now() - last);
  return Math.max(1, Math.ceil(remaining / 1000));
}

module.exports = { isOnCooldown, setCooldown, remainingSeconds };
