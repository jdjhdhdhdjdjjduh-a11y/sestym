const { warnEmbed } = require('./embed-helper');

// يرسل رسالة تأكيد ويضيف ✅❌، وينتظر رد الكاتب بالرياكشن
// يرجع true لو ضغط ✅، false لو ضغط ❌ أو انتهت المهلة بدون رد
async function confirmWithReaction(message, promptText, seconds = 15) {
  const confirmMsg = await message.reply({
    embeds: [warnEmbed('تأكيد مطلوب', `${promptText}\n\nضغط ✅ للتأكيد أو ❌ للإلغاء (${seconds} ثانية).`)]
  });

  await confirmMsg.react('✅');
  await confirmMsg.react('❌');

  try {
    const collected = await confirmMsg.awaitReactions({
      filter: (reaction, user) => ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id,
      max: 1,
      time: seconds * 1000,
      errors: ['time']
    });

    const chosen = collected.first().emoji.name;
    await confirmMsg.delete().catch(() => {});
    return chosen === '✅';
  } catch {
    await confirmMsg.delete().catch(() => {});
    return false;
  }
}

module.exports = { confirmWithReaction };
