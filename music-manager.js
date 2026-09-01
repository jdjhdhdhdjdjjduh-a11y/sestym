const { LavalinkManager } = require('lavalink-client');
const { buildNowPlayingEmbed, buildControlRows } = require('./music-embed');
const { errorEmbed, infoEmbed } = require('./embed-helper');

let client = null;

// ------- تشغيل نظام الموسيقى (يُستدعى مرة وحدة من index.js وقت ما ينعمل الـ client) -------
function initMusic(discordClient) {
  client = discordClient;

  client.lavalink = new LavalinkManager({
    nodes: [
      {
        id: 'main-node',
        host: process.env.LAVALINK_HOST,
        port: Number(process.env.LAVALINK_PORT || 2333),
        authorization: process.env.LAVALINK_PASSWORD,
        secure: process.env.LAVALINK_SECURE === 'true'
      }
    ],
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
