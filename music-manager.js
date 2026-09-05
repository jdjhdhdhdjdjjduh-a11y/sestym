const { LavalinkManager } = require('lavalink-client');
const { buildNowPlayingEmbed, buildControlRows } = require('./music-embed');
const { errorEmbed, infoEmbed } = require('./embed-helper');

let client = null;

// قائمة احتياطية ثابتة - تُستخدم فقط لو تعذر جلب القائمة الحيّة (مثلاً GitHub محجوب)
const FALLBACK_NODES = [
  { id: 'serenetia-v4', host: 'lavalinkv4.serenetia.com', port: 443, authorization: 'https://dsc.gg/ajidevserver', secure: true },
  { id: 'serenetia-main', host: 'lavalink.serenetia.com', port: 443, authorization: 'https://dsc.gg/ajidevserver', secure: true }
];

// ------- جلب قائمة نودات لافا لينك العامة "حيّة" من مصدر مجتمعي يتحدث باستمرار -------
// هذا يحل مشكلة "النودات تطيح بعد فترة" لأننا ما عاد نعتمد على قائمة ثابتة بالكود
// تصير قديمة، وبدلها نجيب أحدث قائمة موجودة وقت ما البوت يشتغل فعليًا
// ------- فحص مسبق لكل نود: نتأكد يرد صح فعليًا قبل ما نضيفه، بدل ما نكتشف
// إنه معطوب بعد ما مكتبة لافا لينك تحاول تستخدمه وتكراش (زي "does not provide /v4/info") -------
async function validateNode(node) {
  const protocol = node.secure ? 'https' : 'http';
  const url = `${protocol}://${node.host}:${node.port}/v4/info`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: node.authorization },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.version; // /v4/info الحقيقي يرجع كائن فيه version دائمًا
  } catch {
    return false;
  }
}

// نودات معروف عنها مشاكل متكررة (رغم إنها تظهر بالقائمة) - نستبعدها دايمًا احتياطًا
const BLOCKED_HOSTS = ['lava-v4.ajieblogs.eu.org'];

async function fetchPublicNodes() {
  const sources = [
    'https://raw.githubusercontent.com/AjieDev/lavalink-list/master/nodes.json',
    'https://raw.githubusercontent.com/botxlab/lavalink-list/main/nodes.json',
    'https://raw.githubusercontent.com/botxlab/lavalink-list/master/nodes.json',
    'https://raw.githubusercontent.com/stackryze/lavalink-list/main/nodes.json',
    'https://raw.githubusercontent.com/bongodevs/lavalink-list/main/nodes.json',
    'https://raw.githubusercontent.com/alfari24/lavalink-lists/main/nodes.json',
    'https://raw.githubusercontent.com/nhutlamm/lavalink-list/main/nodes.json'
  ];

  const results = await Promise.allSettled(sources.map(async (url) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) throw new Error('قائمة فاضية');
    return { url, data };
  }));

  const allNodes = [];
  const seenHosts = new Set();

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    const { url, data } = result.value;

    let addedFromThisSource = 0;
    for (const n of data) {
      if (!n.host || seenHosts.has(n.host) || BLOCKED_HOSTS.includes(n.host)) continue;
      seenHosts.add(n.host);
      allNodes.push({
        id: String(n['unique-id'] || n.identifier || n.host).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        host: n.host,
        port: n.port || 2333,
        authorization: n.password || 'youshallnotpass',
        secure: !!n.secure,
        retryAmount: 2,
        retryDelay: 5000
      });
      addedFromThisSource++;
    }
    console.log(`✅ جلب ${addedFromThisSource} نود جديد من: ${url}`);
  }

  return allNodes.length ? allNodes : null;
}

// ------- تشغيل نظام الموسيقى (يُستدعى مرة وحدة من index.js وقت ما ينعمل الـ client) -------
async function initMusic(discordClient) {
  client = discordClient;

  let nodes = await fetchPublicNodes();
  if (!nodes || !nodes.length) {
    console.warn('⚠️ تعذر الجلب الديناميكي، استخدام القائمة الاحتياطية الثابتة');
    nodes = FALLBACK_NODES;
  }

  // فحص كل نود فعليًا قبل الاعتماد عليه (يشتغل بالتوازي، أقصى 4 ثواني لكل واحد)
  console.log(`🔍 جاري فحص ${nodes.length} نود قبل الاعتماد عليهم...`);
  const checks = await Promise.allSettled(nodes.map(n => validateNode(n)));
  const validNodes = nodes.filter((_, i) => checks[i].status === 'fulfilled' && checks[i].value === true);

  if (validNodes.length) {
    console.log(`✅ ${validNodes.length} من ${nodes.length} نود اجتازوا الفحص واعتمدناهم`);
    nodes = validNodes;
  } else {
    console.warn('⚠️ ولا نود اجتاز الفحص، رح نستخدم القائمة كاملة كحل أخير (مع شبكة الأمان)');
  }

  nodes = nodes.slice(0, 15); // حد أقصى معقول لعدد النودات المتصلة بنفس الوقت (رفعناه لأن المصادر صارت أكثر)

  client.lavalink = new LavalinkManager({
    nodes,
    // الوظيفة اللي ترسل بيانات الاتصال الصوتي لديسكورد عبر الـ Shard الصحيح
    sendToShard: (guildId, payload) => client.guilds.cache.get(guildId)?.shard?.send(payload),
    client: {
      id: process.env.CLIENT_ID,
      username: 'البوت'
    },
    autoSkip: true, // يتخطى تلقائي عند أي خطأ/تعليق بالمقطع بدل ما يوقف كل شي
    playerOptions: {
      defaultSearchPlatform: 'ytsearch',
      volumeDecrementer: 1, // بدون تخفيض تلقائي، الرقم اللي يدخله المستخدم هو نفسه اللي يوصل للسيرفر
      onDisconnect: { autoReconnect: true, destroyPlayer: false },
      onEmptyQueue: { destroyAfterMs: 30_000 }
    },
    queueOptions: {
      maxPreviousTracks: 25
    }
  });

  // ------- أحداث النود (الاتصال بسيرفر لافا لينك نفسه) -------
  client.lavalink.nodeManager
    .on('connect', node => console.log(`✅ اتصل نظام الموسيقى بسيرفر لافا لينك: ${node.id}`))
    .on('error', (node, error) => console.error(`❌ خطأ بسيرفر لافا لينك "${node.id}":`, error?.message || error))
    .on('disconnect', node => console.warn(`⚠️ انقطع الاتصال بسيرفر لافا لينك: ${node.id}`));

  // ------- أحداث المشغّل (لكل سيرفر ديسكورد فيه تشغيل) -------
  client.lavalink
    .on('trackStart', (player, track) => {
      // تحسين تلقائي لوضوح الصوت: نرفع الترددات العالية والمتوسطة شوي
      // عشان نعوّض "التغميض" اللي يصير من ضغط السيرفرات المجانية للصوت
      player.filterManager?.setEQ([
        { band: 0, gain: 0.05 },   // 25Hz - باص خفيف بدون تضخيم زايد
        { band: 1, gain: 0.05 },
        { band: 2, gain: 0.0 },
        { band: 3, gain: 0.0 },
        { band: 4, gain: 0.05 },   // منتصف-منخفض: وضوح الكلام والآلات
        { band: 5, gain: 0.1 },
        { band: 6, gain: 0.15 },   // حضور (Presence): يخلي الصوت "قريب" مو بعيد
        { band: 7, gain: 0.15 },
        { band: 8, gain: 0.1 },    // بريق (Brilliance): وضوح ونقاء
        { band: 9, gain: 0.1 },
        { band: 10, gain: 0.05 },
        { band: 11, gain: 0.05 },
        { band: 12, gain: 0.0 },
        { band: 13, gain: 0.0 }
      ]).catch(() => {});

      const embed = buildNowPlayingEmbed(player, track);
      const rows = buildControlRows(player);
      const channel = client.channels.cache.get(player.textChannelId);
      channel?.send({ embeds: [embed], components: rows }).catch(() => {});
    })
    .on('trackError', (player, track, payload) => {
      console.error('❌ خطأ بتشغيل مقطع:', payload?.exception?.message || payload);
      const channel = client.channels.cache.get(player.textChannelId);
      channel?.send({
        embeds: [errorEmbed('صار خطأ بالتشغيل', 'تعذر تشغيل هذا المقطع (ممكن يكون محذوف أو محمي)، تخطيت للي بعده.')]
      }).catch(() => {});
    })
    .on('trackStuck', player => {
      const channel = client.channels.cache.get(player.textChannelId);
      channel?.send({ embeds: [errorEmbed('تعليق بالتشغيل', 'المقطع علّق، تخطيت للي بعده.')] }).catch(() => {});
    })
    .on('queueEnd', player => {
      const channel = client.channels.cache.get(player.textChannelId);
      channel?.send({ embeds: [infoEmbed('خلص الطابور 🎶', 'ما بقيت أغاني، اكتب `تشغيل` عشان تضيف أكثر.')] }).catch(() => {});
    })
    .on('playerDisconnect', player => {
      const channel = client.channels.cache.get(player.textChannelId);
      channel?.send({ embeds: [infoEmbed('طلع الكل 👋', 'انقطع الاتصال بالروم الصوتي.')] }).catch(() => {});
    });

  // ------- تمرير أحداث Discord الخام للافا لينك (ضروري لإدارة الاتصال الصوتي) -------
  client.on('raw', d => client.lavalink.sendRawData(d));

  console.log('✅ نظام الموسيقى (لافا لينك) جاهز للتهيئة');
}

// يُستدعى من event-ready.js بعد ما البوت يسجل دخول بنجاح (client.user يكون جاهز)
async function connectMusic(discordClient) {
  await discordClient.lavalink.init({ id: discordClient.user.id, username: discordClient.user.username });
}

function getLavalink() {
  if (!client?.lavalink) throw new Error('نظام الموسيقى ما انشغّل بعد');
  return client.lavalink;
}

module.exports = { initMusic, connectMusic, getLavalink };
 
