const { errorEmbed } = require('./embed-helper');

// يتأكد إن العضو عنده الصلاحية المطلوبة، ولو لا يرد برسالة خطأ تختفي تلقائياً
async function checkPermission(message, permissionFlag, label) {
  if (!message.member.permissions.has(permissionFlag)) {
    const reply = await message.reply({ embeds: [errorEmbed('صلاحية ناقصة', `تحتاج صلاحية **"${label}"** بديسكورد عشان تستخدم هذا الأمر.`)] });
    setTimeout(() => reply.delete().catch(() => {}), 6000);
    setTimeout(() => message.delete().catch(() => {}), 6000);
    return false;
  }
  return true;
}

module.exports = { checkPermission };
