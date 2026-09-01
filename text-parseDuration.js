function parseDuration(text) {
  if (!text) return null;
  // يقبل عربي (د/س/ي) أو إنجليزي (m/h/d) بنفس الوقت
  const match = text.match(/^(\d+)\s*(دقيقة|ساعة|يوم|د|س|ي|min|minute|minutes|m|hour|hours|h|day|days|d)$/i);
  if (!match) return null;

  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  if (['د', 'دقيقة', 'm', 'min', 'minute', 'minutes'].includes(unit)) return amount * 60 * 1000;
  if (['س', 'ساعة', 'h', 'hour', 'hours'].includes(unit)) return amount * 60 * 60 * 1000;
  if (['ي', 'يوم', 'd', 'day', 'days'].includes(unit)) return amount * 24 * 60 * 60 * 1000;
  return null;
}

module.exports = { parseDuration };
