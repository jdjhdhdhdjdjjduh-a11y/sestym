require('dotenv').config();
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
initMusic(client); // تهيئة نظام الموسيقى (لافا لينك) - الاتصال الفعلي يصير بعد ready بملف event-ready.js

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

client.login(process.env.DISCORD_TOKEN);

// ------- تشغيل الموقع (لوحة التحكم) بنفس العملية -------
// server.js يحتوي كل كود express ويبدأ الاستماع على المنفذ لوحده وقت ما ينعمل require له
require('./server');
