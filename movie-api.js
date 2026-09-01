// طبقة بسيطة للاتصال بـ TMDB (The Movie Database) - يحتاج مفتاح مجاني من themoviedb.org
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w500';

function isConfigured() {
  return Boolean(process.env.TMDB_API_KEY);
}

async function tmdbFetch(path, params = {}) {
  const url = new URL(TMDB_BASE + path);
  url.searchParams.set('api_key', process.env.TMDB_API_KEY);
  url.searchParams.set('language', 'ar'); // نطلب المحتوى بالعربي أول شي
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

// يبحث عن فيلم أو مسلسل بالاسم، ويرجع أقرب نتيجة مع التفاصيل الكاملة
async function searchTitle(query, type = 'movie') {
  const search = await tmdbFetch(`/search/${type}`, { query });
  if (!search.results?.length) return null;

  let best = search.results[0];

  // لو ما فيه قصة بالعربي، نجيب النسخة الإنجليزية بدل ما نطلع فراغ
  if (!best.overview) {
    const fallback = await tmdbFetch(`/search/${type}`, { query, language: 'en-US' });
    if (fallback.results?.[0]) best = { ...best, overview: fallback.results[0].overview };
  }

  const details = await tmdbFetch(`/${type}/${best.id}`).catch(() => null);

  return {
    id: best.id,
    title: best.title || best.name,
    originalTitle: best.original_title || best.original_name,
    overview: best.overview || 'ما فيه وصف متوفر لهذا العنوان.',
    posterUrl: best.poster_path ? IMG_BASE + best.poster_path : null,
    rating: best.vote_average ? best.vote_average.toFixed(1) : null,
    releaseDate: best.release_date || best.first_air_date || null,
    genres: details?.genres?.map(g => g.name).join('، ') || null,
    runtime: details?.runtime || details?.episode_run_time?.[0] || null,
    tmdbUrl: `https://www.themoviedb.org/${type}/${best.id}`
  };
}

module.exports = { isConfigured, searchTitle };
