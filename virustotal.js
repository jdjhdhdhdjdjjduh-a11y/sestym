const VT_BASE = 'https://www.virustotal.com/api/v3';
const MAX_PER_MINUTE = 4; // حد النسخة المجانية من VirusTotal

const callTimestamps = [];

function hasApiKey() {
  return !!process.env.VIRUSTOTAL_API_KEY;
}

// ينتظر لو وصلنا حد الطلبات المسموحة بالدقيقة، عشان ما ينحظر مفتاح الـ API
async function throttle() {
  const now = Date.now();
  while (callTimestamps.length && now - callTimestamps[0] > 60000) callTimestamps.shift();

  if (callTimestamps.length >= MAX_PER_MINUTE) {
    const waitMs = 60000 - (now - callTimestamps[0]) + 250;
    await new Promise(r => setTimeout(r, waitMs));
    return throttle();
  }
  callTimestamps.push(Date.now());
}

// يفحص رابط بـ VirusTotal - يرجع null لو ما فيه مفتاح API أو صار خطأ (نتجاهل الفحص بصمت وقتها)
async function checkUrlVirusTotal(url) {
  if (!hasApiKey()) return null;
  await throttle();

  try {
    const urlId = Buffer.from(url).toString('base64url').replace(/=+$/, '');
    const res = await fetch(`${VT_BASE}/urls/${urlId}`, {
      headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
    });

    if (res.status === 404) {
      // الرابط مو مفحوص من قبل - نرسله للفحص ونكمل بباقي طبقات الحماية هالمرة (نتيجته تاخذ وقت)
      submitUrlForScan(url).catch(() => {});
      return null;
    }
    if (!res.ok) return null;

    const data = await res.json();
    const stats = data?.data?.attributes?.last_analysis_stats;
    if (!stats) return null;

    return { malicious: stats.malicious || 0, suspicious: stats.suspicious || 0 };
  } catch {
    return null;
  }
}

async function submitUrlForScan(url) {
  if (!hasApiKey()) return;
  await throttle();
  await fetch(`${VT_BASE}/urls`, {
    method: 'POST',
    headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `url=${encodeURIComponent(url)}`
  }).catch(() => {});
}

// يفحص هاش ملف (SHA-256) بـ VirusTotal
async function checkFileHashVirusTotal(sha256) {
  if (!hasApiKey()) return null;
  await throttle();

  try {
    const res = await fetch(`${VT_BASE}/files/${sha256}`, {
      headers: { 'x-apikey': process.env.VIRUSTOTAL_API_KEY }
    });

    if (res.status === 404) return { known: false, malicious: 0 };
    if (!res.ok) return null;

    const data = await res.json();
    const stats = data?.data?.attributes?.last_analysis_stats;
    if (!stats) return null;

    return { known: true, malicious: stats.malicious || 0, suspicious: stats.suspicious || 0 };
  } catch {
    return null;
  }
}

module.exports = { checkUrlVirusTotal, checkFileHashVirusTotal, hasApiKey };
