const { PermissionFlagsBits } = require('discord.js');
const db = require('./db');
const { successEmbed, errorEmbed } = require('./embed-helper');
const { logAction } = require('./log-helper');
const { calculateLevel } = require('./xp-util');

// مفاتيح مسموحة بالتعديل + أسماء بديلة (عربي/إنجليزي) تقدر تكتب أي وحدة منها
const FIELD_ALIASES = {
  xp: 'xp', اكسبي: 'xp', اكس_بي: 'xp',
  level: 'level', مستوى: 'level', لفل: 'level',
  messagecount: 'messageCount', رسائل: 'messageCount', مسج: 'messageCount'
};

module.exports = {
  'تعديل_بيانات': {
    permission: PermissionFlagsBits.Administrator,
    label: 'الإدارة الكاملة',
    async execute(message, args) {
      const target = message.mentions.members.first();

      if (!target || args.length < 2) {
        return message.reply({
          embeds: [errorEmbed(
            'استخدام خاطئ',
            'الصيغة: `تعديل_بيانات @عضو مفتاح:قيمة مفتاح:قيمة ...`\n' +
            'المفاتيح المتاحة: `xp` أو `اكس_بي` / `level` أو `مستوى` / `رسائل` أو `مسج`\n' +
            'مثال: `تعديل_بيانات @فلان xp:12000 مستوى:14 رسائل:5000`'
          )]
        });
      }

      // نستخرج كل أزواج مفتاح:قيمة من الرسالة (نتجاهل المنشن نفسه)
      const pairs = args.filter(a => a.includes(':'));
      if (pairs.length === 0) {
        return message.reply({ embeds: [errorEmbed('استخدام خاطئ', 'لازم تحدد شي واحد على الأقل بصيغة `مفتاح:قيمة`.')] });
      }

      const updates = {};
      const invalid = [];

      for (const pair of pairs) {
        const [rawKey, rawVal] = pair.split(':');
        const key = FIELD_ALIASES[rawKey.trim().toLowerCase()];
        const num = parseInt(rawVal, 10);

        if (!key || isNaN(num) || num < 0) {
          invalid.push(pair);
          continue;
        }
        updates[key] = num;
      }

      if (invalid.length > 0) {
        return message.reply({
          embeds: [errorEmbed('قيم غير صحيحة', `ما قدرت أفهم: ${invalid.map(i => `\`${i}\``).join('، ')}\nتأكد إن المفتاح صحيح والقيمة رقم موجب.`)]
        });
      }

      const memberDoc = await db.getMember(message.guild.id, target.id);

      if (updates.xp !== undefined) memberDoc.xp = updates.xp;
      if (updates.messageCount !== undefined) memberDoc.messageCount = updates.messageCount;

      // لو غيّرنا الـ XP وما حدد مستوى يدوي، نعيد حساب المستوى تلقائيًا حسب الـ XP الجديد
      if (updates.level !== undefined) {
        memberDoc.level = updates.level;
      } else if (updates.xp !== undefined) {
        memberDoc.level = calculateLevel(memberDoc.xp);
      }

      await db.saveMember(message.guild.id, target.id, memberDoc);

      const summary = Object.entries(updates).map(([k, v]) => {
        const names = { xp: 'XP', level: 'المستوى', messageCount: 'عدد الرسائل' };
        return `**${names[k]}:** ${v.toLocaleString('en-US')}`;
      }).join('\n');

      await message.channel.send({
        embeds: [successEmbed('تم التعديل', `تم تحديث بيانات **${target.user.tag}**:\n${summary}`)]
      });
      await logAction(message, { emoji: '✏️', title: 'تعديل بيانات عضو', target: target.user, reason: summary });
    }
  }
};
