const { MongoClient, ObjectId } = require('mongodb');

const client = new MongoClient(process.env.MONGODB_URI);
let db = null;

function getDb() {
  if (!db) throw new Error('قاعدة البيانات لسا ما اتصلت - لازم initTables تنفذ وتخلص أول');
  return db;
}

// ---------- الاتصال وإنشاء الفهارس ----------
async function initTables() {
  await client.connect();
  // اسم قاعدة البيانات: يستخدم الاسم المحدد بالرابط نفسه، وإلا "discord_bot" افتراضيًا
  db = client.db(process.env.MONGODB_DB_NAME || undefined || 'discord_bot');

  await Promise.all([
    db.collection('members').createIndex({ guildId: 1, xp: -1 }),
    db.collection('daily_activity').createIndex({ guildId: 1, day: 1 }),
    db.collection('backups').createIndex({ guildId: 1, createdAt: -1 })
  ]);

  console.log('✅ تم الاتصال بقاعدة بيانات MongoDB وإنشاء الفهارس');
}

// الإعدادات الافتراضية لأي سيرفر جديد
const DEFAULT_SETTINGS = {
  welcome: { enabled: false, channelId: null, message: 'أهلاً {user} بسيرفر {server}! 🎉', withImage: true },
  autoRole: { enabled: false, roleId: null },
  logs: {
    enabled: false, channelId: null,
    events: { messageDelete: true, messageEdit: true, memberJoin: true, memberLeave: true, roleChange: true, banKick: true }
  },
  moderation: {
    badWordsEnabled: false, badWords: [], linkFilterEnabled: false, allowedLinkDomains: [],
    warnLimit: 3, warnAction: 'mute'
  },
  suggestions: { enabled: false, channelId: null, upvoteEmoji: '✅', downvoteEmoji: '❌' },
  leveling: { enabled: false, xpPerMessage: 15, cooldownSeconds: 60, levelUpChannelId: null, roleRewards: [] },
  autoResponses: [],
  adminRoleIds: [],
  // هوية البوت المخصصة لكل سيرفر (اسم مستعار وصورة رمزية مختلفة عن الافتراضية)
  identity: { nickname: null, avatarUrl: null },
  // ------- أنظمة الحماية المتقدمة -------
  security: {
    antiRaid: {
      enabled: false,
      maxJoins: 5,          // عدد الأعضاء
      timeWindowSeconds: 10, // خلال هذي المدة
      action: 'kick'         // kick | ban
    },
    linkScanner: {
      enabled: false,
      whitelist: [],           // نطاقات مسموحة دايمًا (يوتيوب، تيك توك...)
      checkDomainAge: true,
      minDomainAgeDays: 14,
      checkVirusTotal: true,
      action: 'delete_and_mute' // delete_only | delete_and_mute | delete_and_kick | delete_and_ban
    },
    fileScanner: {
      enabled: false,
      quarantineChannelId: null,
      actionOnMalware: 'ban'    // delete_only | kick | ban
    },
    ocrScanner: { enabled: false }, // يشتغل بالتزامن مع linkScanner لفحص النصوص بالصور
    logChannelId: null
  }
};

const DEFAULT_MEMBER = { xp: 0, level: 0, messageCount: 0, lastXpTimestamp: null, warnings: [], joinedAt: new Date().toISOString() };

function memberId(guildId, userId) { return `${guildId}:${userId}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

// ---------- إعدادات السيرفر ----------
async function getSettings(guildId) {
  const doc = await getDb().collection('guild_settings').findOne({ _id: guildId });
  if (!doc) {
    await getDb().collection('guild_settings').insertOne({ _id: guildId, ...DEFAULT_SETTINGS });
    return { ...DEFAULT_SETTINGS };
  }
  const { _id, ...settings } = doc;
  return { ...DEFAULT_SETTINGS, ...settings };
}

// يحدث قسم واحد بس من الإعدادات (نفس سلوك الكود القديم بالضبط - بقية الأقسام ما تتأثر)
async function updateSettings(guildId, partialSection) {
  await getSettings(guildId); // يتأكد إن السجل موجود
  await getDb().collection('guild_settings').updateOne({ _id: guildId }, { $set: partialSection });
  return getSettings(guildId);
}

// ---------- بيانات الأعضاء ----------
async function getMember(guildId, userId) {
  const doc = await getDb().collection('members').findOne({ _id: memberId(guildId, userId) });
  if (!doc) {
    await getDb().collection('members').insertOne({ _id: memberId(guildId, userId), guildId, userId, ...DEFAULT_MEMBER });
    return { ...DEFAULT_MEMBER };
  }
  const { _id, guildId: _g, userId: _u, ...rest } = doc;
  return { ...DEFAULT_MEMBER, ...rest };
}

async function saveMember(guildId, userId, data) {
  await getDb().collection('members').updateOne(
    { _id: memberId(guildId, userId) },
    { $set: { guildId, userId, ...data } },
    { upsert: true }
  );
}

async function getAllMembersSorted(guildId, limit = 10) {
  const docs = await getDb().collection('members')
    .find({ guildId })
    .sort({ xp: -1 })
    .limit(limit)
    .toArray();
  return docs.map(({ _id, guildId: _g, ...rest }) => rest);
}

async function countMembersAbove(guildId, xp) {
  // ملاحظة: مافيه أي حد أقصى لحجم الرقم هنا (بعكس Postgres)، فمشكلة تجاوز الحد سابقًا مستحيلة تتكرر
  return getDb().collection('members').countDocuments({ guildId, xp: { $gt: xp } });
}

// ---------- الاقتراحات ----------
async function createSuggestion({ guildId, messageId, channelId, authorId, content }) {
  await getDb().collection('suggestions').insertOne({
    _id: messageId, guildId, channelId, authorId, content, upvotes: 0, downvotes: 0, status: 'pending'
  });
}

async function getSuggestion(messageId) {
  return getDb().collection('suggestions').findOne({ _id: messageId });
}

async function updateSuggestionVotes(messageId, upvotes, downvotes) {
  await getDb().collection('suggestions').updateOne({ _id: messageId }, { $set: { upvotes, downvotes } });
}

// ---------- الاستطلاعات ----------
async function createPoll({ guildId, messageId, channelId, question, options, emojis, authorId }) {
  await getDb().collection('polls').insertOne({
    _id: messageId, guildId, channelId, question, options, emojis, authorId, closed: false
  });
}

// ---------- النسخ الاحتياطية ----------
async function createBackup(guildId, createdBy, data) {
  const result = await getDb().collection('backups').insertOne({ guildId, createdBy, data, createdAt: new Date() });
  return result.insertedId.toString();
}

async function getBackupById(id) {
  let objId;
  try { objId = new ObjectId(id); } catch { return null; }
  const doc = await getDb().collection('backups').findOne({ _id: objId });
  return doc ? { data: doc.data } : null;
}

async function getLatestBackup(guildId) {
  const doc = await getDb().collection('backups').find({ guildId }).sort({ createdAt: -1 }).limit(1).next();
  return doc ? { data: doc.data } : null;
}

// ---------- إحصائيات عامة للوحة التحكم ----------
async function getGuildAggregateStats(guildId) {
  const result = await getDb().collection('members').aggregate([
    { $match: { guildId } },
    { $group: {
        _id: null,
        tracked_members: { $sum: 1 },
        total_messages: { $sum: { $ifNull: ['$messageCount', 0] } },
        total_warnings: { $sum: { $size: { $ifNull: ['$warnings', []] } } },
        top_level: { $max: { $ifNull: ['$level', 0] } }
    }}
  ]).toArray();

  if (result.length === 0) return { tracked_members: 0, total_messages: 0, total_warnings: 0, top_level: 0 };
  const { _id, ...rest } = result[0];
  return rest;
}

async function getGuildSuggestionStats(guildId) {
  const total = await getDb().collection('suggestions').countDocuments({ guildId });
  return { total };
}

// ---------- إدارة الإنذارات من الموقع ----------
async function getMembersWithWarnings(guildId) {
  const docs = await getDb().collection('members').aggregate([
    { $match: { guildId, 'warnings.0': { $exists: true } } },
    { $addFields: { warningCount: { $size: '$warnings' } } },
    { $sort: { warningCount: -1 } }
  ]).toArray();

  return docs.map(({ _id, guildId: _g, warningCount, ...rest }) => rest);
}

async function clearOneWarning(guildId, userId, index) {
  const member = await getMember(guildId, userId);
  member.warnings.splice(index, 1);
  await saveMember(guildId, userId, member);
}

async function clearAllWarningsFor(guildId, userId) {
  const member = await getMember(guildId, userId);
  member.warnings = [];
  await saveMember(guildId, userId, member);
}

// ---------- تتبع النشاط اليومي (للرسم البياني بالموقع) ----------
async function incrementDailyMessage(guildId) {
  const day = todayStr();
  await getDb().collection('daily_activity').updateOne(
    { _id: `${guildId}:${day}` },
    { $set: { guildId, day }, $inc: { messageCount: 1 } },
    { upsert: true }
  );
}

async function incrementDailyNewMember(guildId) {
  const day = todayStr();
  await getDb().collection('daily_activity').updateOne(
    { _id: `${guildId}:${day}` },
    { $set: { guildId, day }, $inc: { newMembers: 1 } },
    { upsert: true }
  );
}

async function getDailyActivity(guildId, days = 14) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const docs = await getDb().collection('daily_activity')
    .find({ guildId, day: { $gte: sinceStr } })
    .sort({ day: 1 })
    .toArray();

  return docs.map(d => ({ day: d.day, message_count: d.messageCount || 0, new_members: d.newMembers || 0 }));
}

// ---------- تصفير بيانات المستويات (XP/رسائل/مستوى) ----------
async function resetMemberLeveling(guildId, userId) {
  const member = await getMember(guildId, userId);
  member.xp = 0;
  member.level = 0;
  member.messageCount = 0;
  member.lastXpTimestamp = null;
  await saveMember(guildId, userId, member);
}

async function resetAllLeveling(guildId) {
  await getDb().collection('members').updateMany(
    { guildId },
    { $set: { xp: 0, level: 0, messageCount: 0, lastXpTimestamp: null } }
  );
}

module.exports = {
  client, getDb, initTables,
  getSettings, updateSettings,
  getMember, saveMember, getAllMembersSorted, countMembersAbove,
  createSuggestion, getSuggestion, updateSuggestionVotes,
  createPoll,
  createBackup, getBackupById, getLatestBackup,
  getGuildAggregateStats, getGuildSuggestionStats,
  getMembersWithWarnings, clearOneWarning, clearAllWarningsFor,
  incrementDailyMessage, incrementDailyNewMember, getDailyActivity,
  resetMemberLeveling, resetAllLeveling
};
