// GayPornScraper - Unified Syncler V2 provider script

const PROVIDER_MAP = {
  manporn: 'https://manporn.xxx',
  needgayporn: 'https://needgayporn.com',
  boyfriendtv: 'https://www.boyfriendtv.com',
  pornhoarder: 'https://pornhoarder.tv',
  nurgay: 'https://nurgay.to',
  fxggxt: 'https://fxggxt.com',
  // "cinegay" is kept for legacy/inactive
};

const DESKTOP_UA = 
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';

async function fetchHTML(url) {
  let resp;
  for (let tries = 0; tries < 2; tries++) {
    resp = await fetch(url, {
      headers: {
        'User-Agent': DESKTOP_UA,
        'Accept': 'text/html,application/xhtml+xml'
      },
    });
    if (resp.status !== 429 && resp.status !== 503) break;
    await new Promise(r => setTimeout(r, 5000));
  }
  if (!resp.ok) throw new Error(`Failed to fetch: ${url}`);
  return await resp.text();
}

function toAbsolute(url, base) {
  try {
    return new URL(url, base).href;
  } catch { return url; }
}

function clean(str) {
  return (str || '').replace(/[\t\n\r]+/g, ' ').trim();
}

function durationNormalize(txt) {
  if (/^\d{1,2}:\d{2}$/.test(txt)) return txt;
  const m = txt.match(/(\d{1,2})\s*min/);
  if (m) return `${parseInt(m[1])}:00`;
  return '';
}

// --- Main Search Entrypoint ---

async function search(query, providerId) {
  if (providerId === 'cinegay') return [];

  const base = PROVIDER_MAP[providerId];
  const results = [];

  let searchUrl;
  if (providerId === 'boyfriendtv') {
    searchUrl = `${base}/search/videos/${encodeURIComponent(query)}/`;
  } else {
    searchUrl = `${base}/?s=${encodeURIComponent(query)}`;
  }
  let html;
  try {
    html = await fetchHTML(searchUrl);
  } catch {
    return [];
  }

  // Selectors per provider/theme
  let cardSelector, linkSel, imgSel, durSel, titleSel;
  if (['manporn', 'needgayporn', 'pornhoarder', 'nurgay', 'fxggxt'].includes(providerId)) {
    cardSelector = 'article.post, div.video-item, div.post, div.grid-item, div[class*=item]';
    linkSel = 'a[rel=bookmark], a[href*="/video/"], a.thumb';
    imgSel = 'img, .thumb img';
    durSel = '.duration, .dur, .vid-duration, span.time, .overlay span';
    titleSel = 'h2, .title, .post-title, a[rel=bookmark]';
  } else if (providerId === 'boyfriendtv') {
    cardSelector = '.thumb-block, .video-item';
    linkSel = 'a.thumb-block, a.video-title';
    imgSel = 'img';
    durSel = '.duration';
    titleSel = '.video-title, .thumb-block-title, a.video-title';
  }

  // Parse DOM structure
  let doc = new DOMParser().parseFromString(html, 'text/html');
  let cards = Array.from(doc.querySelectorAll(cardSelector)).slice(0, 10);
  for (let card of cards) {
    try {
      let titleEl = card.querySelector(titleSel) || card.querySelector(linkSel) || card;
      let name = clean(titleEl?.textContent);
      let link = toAbsolute(card.querySelector(linkSel)?.href, base);

      let thumb = card.querySelector(imgSel)?.getAttribute('data-src') ||
                  card.querySelector(imgSel)?.src ||
                  card.querySelector(imgSel)?.getAttribute('srcset')?.split(' ')[0] || '';
      thumb = toAbsolute(thumb, base);

      let dur = clean(card.querySelector(durSel)?.textContent || '');
      dur = durationNormalize(dur);

      results.push({
        name,
        url: link,
        thumb,
        duration: dur,
        provider: providerId,
      });
    } catch { /* skip card errors */ }
  }

  // Fetch detail page for each result concurrently (limit 10)
  const finalResults = await Promise.all(results.map(async res => {
    try {
      let html2 = await fetchHTML(res.url);
      let doc2 = new DOMParser().parseFromString(html2, 'text/html');
      // Extract playable/embed url
      let videoUrl = '', description = '', tags = [], quality = 'SD';

      if (['manporn', 'needgayporn', 'pornhoarder', 'nurgay', 'fxggxt'].includes(providerId)) {
        let ifr = doc2.querySelector('iframe[src*="dood"], iframe[src*="ds2play"], iframe[src*="streamtape"]');
        ifr && (videoUrl = ifr.src);
        let vidTag = doc2.querySelector('video source');
        vidTag && (videoUrl = vidTag.src);

        description = clean(doc2.querySelector('.desc, .post-content, .description, p')?.textContent);
        tags = Array.from(doc2.querySelectorAll('a[rel="tag"], .tags a, .categories a')).map(e => clean(e.textContent));
        if (/hd|720|1080/i.test(res.name + videoUrl)) quality = 'HD';
      } else if (providerId === 'boyfriendtv') {
        let vid = doc2.querySelector('video source');
        if (vid) {
          videoUrl = vid.src;
        } else {
          // Check for in-page JSON sources
          let script = Array.from(doc2.querySelectorAll('script')).find(x => x.innerText.includes('sources'));
          if (script) {
            try {
              let sources = JSON.parse(script.innerText.match(/sources\s*:\s*(\[.*?\])/)[1]);
              let best = sources.find(src => src.src?.endsWith('.mp4')) || sources[0];
              videoUrl = best?.src || '';
            } catch {}
          }
        }
        description = clean(doc2.querySelector('.description, .video-desc, .desc, p')?.textContent);
        tags = Array.from(doc2.querySelectorAll('.categories a, .tags a, a[rel="tag"]')).map(e => clean(e.textContent));
        if (/hd|720|1080/i.test(res.name + videoUrl)) quality = 'HD';
      }

      return {
        name: res.name,
        url: videoUrl || res.url,
        thumb: res.thumb,
        duration: res.duration,
        quality,
        description,
        tags: tags.filter(Boolean),
        provider: res.provider
      };
    } catch {
      return res;
    }
  }));

  return finalResults.filter(v => v.url);
}

// --- Stream Resolve Entrypoint (Optional) ---

async function resolve(url) {
  // For most DoodStream/hoster embeds, the public link is sufficient for Syncler
  return { url };
}

// --- Exports for Syncler Kosmos ---
if (typeof module !== 'undefined') {
  module.exports = { search, resolve };
} else {
  self.search = search;
  self.resolve = resolve;
}
