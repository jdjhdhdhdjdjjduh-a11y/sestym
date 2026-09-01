const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { getGuildSettings } = require('./config-cache');
const { scanTextForThreats } = require('./link-scanner');
const { scanAttachment } = require('./file-scanner');
const { extractTextFromImage } = require('./ocr-scanner');
const { errorEmbed, COLORS } = require('./embed-helper');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// الدالة الرئيسية - يرجع true لو الرسالة انحذفت (يعني ما نكمل بمعالجة الرسالة العادية بعدها)
async function runSecurityChecks(message) {
  const settings = await getGuildSettings(message.guild.id);
  const security = settings.security;
  if (!security) return false;

  // ------- 1) فحص الروابط بنص الرسالة العادي -------
  if (security.linkScanner?.enabled) {
    const threat = await scanTextForThreats(message.content, security);
    if (threat) {
      await handleLinkThreat(message, security, threat);
      return true;
    }
  }

  // ------- 2) فحص المرفقات (صور بالـ OCR + ملفات) -------
  if (message.attachments.size > 0) {
    for (const attachment of message.attachments.values()) {
      const name = attachment.name.toLowerCase();
      const dotIndex = name.lastIndexOf('.');
      const ext = dotIndex === -1 ? '' : name.slice(dotIndex);
      const isImage = IMAGE_EXTENSIONS.includes(ext);

      // OCR: قراءة نص من الصورة وفحصه بنفس ماسح الروابط
      if (isImage && security.ocrScanner?.enabled && security.linkScanner?.enabled) {
        const extractedText = await extractTextFromImage(attachment.url);
        if (extractedText) {
          const threat = await scanTextForThreats(extractedText, security);
          if (threat) {
            await handleLinkThreat(message, security, { ...threat, fromImage: true });
            return true;
          }
        }
      }

      // فحص الملف نفسه (فايروسات + امتدادات خطيرة)
      if (security.fileScanner?.enabled) {
        const result = await scanAttachment(attachment, message.author.createdTimestamp);

        if (result.verdict === 'malware') {
          await handleMalwareFile(message, security, attachment, result);
          return true;
        }
        if (result.verdict === 'quarantine') {
          await handleQuarantineFile(message, security, attachment);
          return true;
        }
      }
    }
  }

  return false;
}

// ------- رابط مشبوه/ضار -------
async function handleLinkThreat(message, security, threat) {
  await message.delete().catch(() => {});

  const action = security.linkScanner.action;
  const member = message.member;

  try {
    if (action === 'delete_and_mute' && member) await member.timeout(10 * 60 * 1000, 'رابط مشبوه/ضار');
    if (action === 'delete_and_kick' && member) await member.kick('رابط مشبوه/ضار');
    if (action === 'delete_and_ban' && member) await member.ban({ reason: 'رابط مشبوه/ضار' });
  } catch (err) {
    console.error('❌ فشل تطبيق إجراء ماسح الروابط:', err.message);
  }

  const warnMsg = await message.channel.send({
    embeds: [errorEmbed(
      '🔗 رابط مشبوه',
      `<@${message.author.id}> تم حذف رسالتك.\n**السبب:** ${threat.reason}${threat.fromImage ? '\n*(اكتُشف داخل صورة عبر قراءة النص التلقائية)*' : ''}`
    )]
  }).catch(() => null);
  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 8000);

  await notifySecurity(message, security, {
    emoji: '🔗', title: 'رابط مشبوه/ضار',
    description: `**الرابط:** \`${threat.domain}\`\n**السبب:** ${threat.reason}\n**الإجراء المطبّق:** ${action}`
  });
}

// ------- ملف فايروس مؤكد -------
async function handleMalwareFile(message, security, attachment, result) {
  await message.delete().catch(() => {});

  const member = message.member;
  try {
    if (security.fileScanner.actionOnMalware === 'ban' && member) await member.ban({ reason: 'رفع ملف يحتوي فايروس' });
    if (security.fileScanner.actionOnMalware === 'kick' && member) await member.kick('رفع ملف يحتوي فايروس');
  } catch (err) {
    console.error('❌ فشل تطبيق إجراء ماسح الملفات:', err.message);
  }

  await notifySecurity(message, security, {
    emoji: '🦠', title: 'ملف فايروس تم اكتشافه',
    description: `**الملف:** ${attachment.name}\n**عدد محركات الفحص اللي رصدته:** ${result.malicious}\n**الإجراء المطبّق:** ${security.fileScanner.actionOnMalware}`
  });
}

// ------- ملف بامتداد حساس من حساب جديد → عزل للمراجعة اليدوية -------
async function handleQuarantineFile(message, security, attachment) {
  const quarantineChannel = security.fileScanner.quarantineChannelId
    ? message.guild.channels.cache.get(security.fileScanner.quarantineChannelId)
    : null;

  if (quarantineChannel) {
    try {
      const res = await fetch(attachment.url);
      const buffer = Buffer.from(await res.arrayBuffer());
      const copy = new AttachmentBuilder(buffer, { name: attachment.name });
      await quarantineChannel.send({
        content: `⚠️ ملف بامتداد حساس من <@${message.author.id}> بقناة <#${message.channel.id}> — بانتظار مراجعة يدوية (الحساب عمره أقل من أسبوع)`,
        files: [copy]
      });
    } catch (err) {
      console.error('❌ فشل نقل الملف لروم العزل:', err.message);
    }
  }

  await message.delete().catch(() => {});

  const warnMsg = await message.channel.send({
    embeds: [errorEmbed('📁 ملف بامتداد حساس', `<@${message.author.id}> ملفك (**${attachment.name}**) انحول لمراجعة الإدارة لأن حسابك جديد وامتداد الملف حساس.`)]
  }).catch(() => null);
  if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 8000);
}

async function notifySecurity(message, security, { emoji, title, description }) {
  if (!security.logChannelId) return;
  const channel = message.guild.channels.cache.get(security.logChannelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle(`${emoji} ${title}`)
    .setDescription(description)
    .addFields(
      { name: 'العضو', value: `<@${message.author.id}>`, inline: true },
      { name: 'القناة', value: `<#${message.channel.id}>`, inline: true }
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});
}

module.exports = { runSecurityChecks };
