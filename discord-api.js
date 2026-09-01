const BASE_URL = 'https://discord.com/api/v10';

async function botFetch(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Discord API error: ${res.status}`);
  return res.json();
}

async function getGuildChannels(guildId) {
  const channels = await botFetch(`/guilds/${guildId}/channels`);
  return channels.filter(c => c.type === 0);
}

async function getGuildRoles(guildId) {
  const roles = await botFetch(`/guilds/${guildId}/roles`);
  return roles.filter(r => r.name !== '@everyone').sort((a, b) => b.position - a.position);
}

async function getGuildInfo(guildId) {
  return botFetch(`/guilds/${guildId}?with_counts=true`);
}

async function getUserInfo(userId) {
  return botFetch(`/users/${userId}`);
}

// يحول رابط صورة إلى Data URI (base64) عشان API ديسكورد يقبله كصورة أفتار
async function urlToDataUri(imageUrl) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`تعذر تحميل الصورة من الرابط (HTTP ${res.status})`);

  const contentType = res.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) throw new Error('الرابط المعطى ما يشير لصورة صالحة');

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) throw new Error('حجم الصورة كبير جدًا (الحد الأقصى 10MB)');

  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

// يغيّر اسم ولقب/صورة البوت الخاصين بسيرفر معيّن بس (Per-Guild Bot Profile)
// يحتاج توكن البوت فقط، بدون أي صلاحيات إضافية على مستوى المستخدم
async function updateBotGuildProfile(guildId, { nickname, avatarUrl }) {
  const body = {};

  // nickname: نص جديد، أو null صريح لإرجاع الاسم الافتراضي
  if (nickname !== undefined) body.nick = nickname;

  if (avatarUrl !== undefined) {
    body.avatar = avatarUrl ? await urlToDataUri(avatarUrl) : null;
  }

  const res = await fetch(`${BASE_URL}/guilds/${guildId}/members/@me`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Discord API error: ${res.status} ${errText}`);
  }

  return res.json();
}

module.exports = { getGuildChannels, getGuildRoles, getGuildInfo, getUserInfo, updateBotGuildProfile };
