const { REST, Routes, ActivityType } = require('discord.js');
const { setBotIcon } = require('./embed-helper');
const { connectMusic } = require('./music-manager');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`✅ البوت شغال باسم ${client.user.tag}`);

    // تفعيل شعار البوت بفوتر كل الـ Embeds
    setBotIcon(client.user.displayAvatarURL());

    // حالة البوت (يظهر تحت اسمه بقائمة الأعضاء)
    client.user.setPresence({
      activities: [{ name: `يشرف على ${client.guilds.cache.size} سيرفر | اكتب مساعدة`, type: ActivityType.Watching }],
      status: 'online'
    });

    // الاتصال بسيرفر لافا لينك (نظام الموسيقى) - لازم client.user يكون جاهز أول
    try {
      await connectMusic(client);
    } catch (err) {
      console.error('❌ تعذر الاتصال بسيرفر لافا لينك:', err?.message || err);
    }

    const commands = client.commands.map(cmd => cmd.data.toJSON());
    const rest = new REST().setToken(process.env.DISCORD_TOKEN);

    try {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
      console.log(`✅ تم تسجيل ${commands.length} أمر بنجاح`);
    } catch (error) {
      console.error('❌ خطأ بتسجيل الأوامر:', error);
    }
  }
};
