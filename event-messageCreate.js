const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const db = require('./db');
const { calculateLevel } = require('./xp-util');
const textCommands = require('./text-commands');
const { checkPermission } = require('./text-permissions');
const { errorEmbed, warnEmbed, COLORS } = require('./embed-helper');
const { isOnCooldown, setCooldown, remainingSeconds } = require('./cooldown');
const { createLevelUpBanner } = require('./levelup-card');
const { runSecurityChecks } = require('./security-handler');

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // ===== أنظمة الحماية المتقدمة (روابط/ملفات/OCR) - قبل أي شي ثاني =====
    const wasBlocked = await runSecurityChecks(message).catch(err => {
      console.error('❌ خطأ بأنظمة الحماية:', err.message);
      return false;
    });
    if (wasBlocked) return;

    // ===== 0) أوامر الإدارة النصية (بدون سلاش) =====
    const firstWord = message.content.trim().split(/\s+/)[0];
    const command = textCommands[firstWord];
    if (command) {
      const args = message.content.trim().split(/\s+/).slice(1);
      const hasPermission = await checkPermission(message, command.permission, command.label);
      if (!hasPermission) return;

      // حماية من السبام - كولداون بسيط بين كل أمر وأمر لنفس العضو
      if (isOnCooldown(message.author.id)) {
        const reply = await message.reply({ embeds: [errorEmbed('تمهل شوي', `تقدر تستخدم أمر ثاني بعد ${remainingSeconds(message.author.id)} ثانية.`)] });
        setTimeout(() => reply.delete().catch(() => {}), 3000);
        return;
      }
      setCooldown(message.author.id);

      try {
        await command.execute(message, args);
        // حذف رسالة الأمر تلقائيًا بعد التنفيذ الناجح، إلا لو الأمر معلوماتي (deleteInvoke: false)
        if (command.deleteInvoke !== false) {
          await message.delete().catch(() => {});
        }
      } catch (err) {
        console.error(`❌ خطأ بتنفيذ أمر "${firstWord}":`, err);
        await message.reply({ embeds: [errorEmbed('صار خطأ غير متوقع', `تعذر تنفيذ أمر \`${firstWord}\`. جرب مرة ثانية، ولو استمرت المشكلة بلغ الإدارة.`)] });
      }
      return;
    }

    const settings = await db.getSettings(message.guild.id);

    // ===== 1) الفلترة =====
    const wasDeleted = await handleModeration(message, settings);
    if (wasDeleted) return;

    // ===== 2) الردود التلقائية =====
    await handleAutoResponses(message, settings);

    // ===== 3) نظام XP =====
    if (settings.leveling.enabled) {
      await handleXP(message, settings);
    }
  }
};

async function handleModeration(message, settings) {
  const { moderation } = settings;
  const content = message.content.toLowerCase();

  if (moderation.linkFilterEnabled) {
    const links = content.match(URL_REGEX);
    if (links) {
      const isAllowed = links.every(link => moderation.allowedLinkDomains.some(domain => link.includes(domain)));
      if (!isAllowed) {
        await message.delete().catch(() => {});
        await warnMember(message, settings, 'إرسال رابط غير مسموح');
        return true;
      }
    }
  }

  if (moderation.badWordsEnabled && moderation.badWords.length > 0) {
    const hasBadWord = moderation.badWords.some(word => content.includes(word.toLowerCase()));
    if (hasBadWord) {
      await message.delete().catch(() => {});
      await warnMember(message, settings, 'استخدام ألفاظ غير لائقة');
      return true;
    }
  }

  return false;
}

async function warnMember(message, settings, reason) {
  const memberDoc = await db.getMember(message.guild.id, message.author.id);
  memberDoc.warnings.push({ reason, date: new Date().toISOString() });
  await db.saveMember(message.guild.id, message.author.id, memberDoc);

  const warnCount = memberDoc.warnings.length;
  const embed = warnEmbed('تم حذف رسالتك', `**السبب:** ${reason}\n**الإنذارات:** ${warnCount}/${settings.moderation.warnLimit}`);
  const warnMsg = await message.channel.send({ content: `<@${message.author.id}>`, embeds: [embed] });
  setTimeout(() => warnMsg.delete().catch(() => {}), 8000);

  if (warnCount >= settings.moderation.warnLimit && settings.moderation.warnAction !== 'none') {
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    try {
      if (settings.moderation.warnAction === 'kick') await member.kick('تجاوز حد الإنذارات');
      if (settings.moderation.warnAction === 'ban') await member.ban({ reason: 'تجاوز حد الإنذارات' });
      if (settings.moderation.warnAction === 'mute') await member.timeout(10 * 60 * 1000, 'تجاوز حد الإنذارات');
    } catch (err) {
      console.error('❌ فشل تطبيق إجراء الإنذار:', err.message);
    }
  }
}

async function handleAutoResponses(message, settings) {
  const content = message.content.toLowerCase();

  for (const auto of settings.autoResponses) {
    const trigger = auto.trigger.toLowerCase();
    const matched = auto.exactMatch ? content === trigger : content.includes(trigger);
    if (matched) {
      await message.reply(auto.response);
      break;
    }
  }
}

async function handleXP(message, settings) {
  const memberDoc = await db.getMember(message.guild.id, message.author.id);
  memberDoc.messageCount += 1;
  await db.incrementDailyMessage(message.guild.id);

  const now = new Date();
  const cooldownMs = settings.leveling.cooldownSeconds * 1000;

  if (memberDoc.lastXpTimestamp && (now - new Date(memberDoc.lastXpTimestamp)) < cooldownMs) {
    await db.saveMember(message.guild.id, message.author.id, memberDoc); // نحفظ عدد الرسائل بس
    return;
  }

  const oldLevel = memberDoc.level;
  // سقف أقصى دفاعي: حتى لو صار خلل بمصدر الإعدادات، لا يُعطى أكثر من 1000 XP بالرسالة الوحدة
  const safeXpGain = Math.min(Math.max(settings.leveling.xpPerMessage, 0), 1000);
  memberDoc.xp += safeXpGain;
  memberDoc.level = calculateLevel(memberDoc.xp);
  memberDoc.lastXpTimestamp = now.toISOString();
  await db.saveMember(message.guild.id, message.author.id, memberDoc);

  if (memberDoc.level > oldLevel) {
    const announceChannel = settings.leveling.levelUpChannelId
      ? message.guild.channels.cache.get(settings.leveling.levelUpChannelId)
      : message.channel;

    if (announceChannel) {
      try {
        const member = message.member;
        const buffer = await createLevelUpBanner(member, memberDoc.level);
        const attachment = new AttachmentBuilder(buffer, { name: 'levelup.png' });
        await announceChannel.send({ content: `<@${message.author.id}>`, files: [attachment] });
      } catch (err) {
        console.error('❌ خطأ ببانر صعود المستوى:', err.message);
        const embed = new EmbedBuilder().setColor(COLORS.warn).setDescription(`🎉 <@${message.author.id}> وصل للمستوى **${memberDoc.level}**!`);
        await announceChannel.send({ embeds: [embed] });
      }
    }

    const reward = settings.leveling.roleRewards.find(r => r.level === memberDoc.level);
    if (reward) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      const role = message.guild.roles.cache.get(reward.roleId);
      if (member && role) await member.roles.add(role).catch(() => {});
    }
  }
}
