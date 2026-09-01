const db = require('./db');

// كاش بالذاكرة: guildId -> { settings, expiresAt }
// عشان ما نستعلم قاعدة البيانات بكل رسالة/عضو جديد - بس كل ما تنتهي صلاحية الكاش أو تتغير الإعدادات يدويًا
const cache = new Map();
const TTL_MS = 60 * 1000; // دقيقة وحدة - توازن بين السرعة وسرعة انعكاس التعديلات من الموقع

async function getGuildSettings(guildId) {
  const cached = cache.get(guildId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.settings;
  }

  const settings = await db.getSettings(guildId);
  cache.set(guildId, { settings, expiresAt: Date.now() + TTL_MS });
  return settings;
}

// يستدعيها الموقع بعد أي حفظ إعدادات - يخلي التعديل ينعكس فورًا بدل انتظار انتهاء الكاش
function invalidateGuildCache(guildId) {
  cache.delete(guildId);
}

module.exports = { getGuildSettings, invalidateGuildCache };
