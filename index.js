require('dotenv').config();

// ------- شبكة أمان عامة: تمنع أي خطأ غير متوقع (خصوصًا من نودات لافا لينك العامة
// غير الموثوقة اللي نجيبها ديناميكيًا) من إسقاط العملية بالكامل بصمت -------
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ خطأ غير ممسوك (Promise):', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ خطأ غير ممسوك (Exception):', err?.message || err);
});

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const db = require('./db');
const { setClient } = require('./bot-status');
const { loadArabicFont } = require('./font-loader');
const { initMusic } = require('./music-manager');

// تحميل الخط العربي أول شي - قبل أي محاولة رسم صورة (بروفايل، ترحيب، مقارنة...)
loadArabicFont();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates // مطلوبة لأوامر الصوتيات
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

setClient(client); // عشان الموقع يقدر يتأكد من حالة اتصال البوت
const musicReady = initMusic(client); // تهيئة نظام الموسيقى (لافا لينك) - يجيب قائمة النودات الحيّة أول

// ------- الأوامر (Slash Commands) -------
client.commands = new Collection();
const slashCommands = [
  require('./command-suggest'),
  require('./command-poll'),
  require('./command-leaderboard')
];
for (const cmd of slashCommands) client.commands.set(cmd.data.name, cmd);

// ------- الأحداث (Events) -------
const events = [
  require('./event-ready'),
  require('./event-interactionCreate'),
  require('./event-guildMemberAdd'),
  require('./event-guildMemberRemove'),
  require('./event-messageCreate'),
  require('./event-messageDelete'),
  require('./event-messageUpdate'),
  require('./event-messageReactionAdd'),
  require('./event-messageReactionRemove')
];
for (const event of events) {
  if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
  else client.on(event.name, (...args) => event.execute(...args, client));
}

// ------- تشغيل قاعدة البيانات ثم البوت -------
db.initTables()
  .then(() => console.log('✅ تم الاتصال بقاعدة البيانات (PostgreSQL)'))
  .catch(err => console.error('❌ فشل الاتصال بقاعدة البيانات:', err));

musicReady
  .catch(err => console.error('❌ فشل تهيئة نظام الموسيقى:', err?.message || err))
  .finally(() => client.login(process.env.DISCORD_TOKEN));

// ------- تشغيل الموقع (لوحة التحكم) بنفس العملية -------
// server.js يحتوي كل كود express ويبدأ الاستماع على المنفذ لوحده وقت ما ينعمل require له
require('./server');
