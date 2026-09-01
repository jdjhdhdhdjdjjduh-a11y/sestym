const { EmbedBuilder } = require('discord.js');

// الألوان الموحدة لكل نوع رد بالبوت
const COLORS = {
  success: 0x00e5a0,
  error: 0xff5470,
  warn: 0xffb020,
  info: 0x7c5cff,
  neutral: 0x4da3ff
};

// يتحدد مرة وحدة وقت تشغيل البوت (من event-ready.js) عشان كل الـ Embeds تحمل نفس الشعار بالفوتر
let botIconURL = null;
function setBotIcon(url) { botIconURL = url; }

function baseEmbed(color) {
  const embed = new EmbedBuilder().setColor(color).setTimestamp();
  if (botIconURL) embed.setFooter({ text: 'نظام إدارة السيرفر', iconURL: botIconURL });
  return embed;
}

// رد نجاح - يستخدم لأي عملية تمت بنجاح (طرد، حظر، حفظ إعداد...)
function successEmbed(title, description) {
  return baseEmbed(COLORS.success)
    .setTitle(`✅ ${title}`)
    .setDescription(description || null);
}

// رد خطأ - استخدام خاطئ لأمر، صلاحية ناقصة، فشل تنفيذ
function errorEmbed(title, description) {
  return baseEmbed(COLORS.error)
    .setTitle(`❌ ${title}`)
    .setDescription(description || null);
}

// تحذير - إنذارات، عمليات خطيرة تحتاج تأكيد
function warnEmbed(title, description) {
  return baseEmbed(COLORS.warn)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description || null);
}

// معلومة عامة - عرض بيانات، قوائم، شرح
function infoEmbed(title, description) {
  return baseEmbed(COLORS.info)
    .setTitle(title)
    .setDescription(description || null);
}

module.exports = { COLORS, baseEmbed, successEmbed, errorEmbed, warnEmbed, infoEmbed, setBotIcon };
