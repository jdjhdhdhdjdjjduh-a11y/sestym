// معادلة بسيطة: كل مستوى يحتاج XP أكثر من اللي قبله
function xpForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

function calculateLevel(totalXp) {
  let level = 0;
  let xpNeeded = xpForLevel(level + 1);
  let remainingXp = totalXp;

  while (remainingXp >= xpNeeded) {
    remainingXp -= xpNeeded;
    level++;
    xpNeeded = xpForLevel(level + 1);
  }
  return level;
}

module.exports = { xpForLevel, calculateLevel };
