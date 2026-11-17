/* Pulls the website text from Google Sheets, then starts the page.

   SETUP — paste the two "Publish to web" CSV links here
   (Google Sheet → File → Share → Publish to web → pick the tab → CSV → Publish).
   Leave a link empty to use the text already written in index.html. */
const SHEET_CSV = {
  text:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vRU8Q0e8d8LeVeD06gEk3QmTf6f2OKwX3O6O5vdi1Wg91wiUxWPnkGrHITy380YTIC5MnlpCKIKYAta/pub?gid=1648583457&single=true&output=csv',   // the "Website text" tab
  timeline: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRU8Q0e8d8LeVeD06gEk3QmTf6f2OKwX3O6O5vdi1Wg91wiUxWPnkGrHITy380YTIC5MnlpCKIKYAta/pub?gid=1572759143&single=true&output=csv',   // the "Timeline" tab
};

(() => {
  const TIMEOUT_MS = 4000; // if Google is slow, show the built-in text instead of waiting

  /* ---------- CSV ---------- */
  function parseCSV(src) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      if (q) {
        if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
    return rows.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
  }
  const pick = (row, ...names) => { for (const n of names) if (row[n] != null) return row[n]; return ''; };

  /* ---------- Formatting: *italic*  **bold**  {small}  new line ---------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\{(.+?)\}/g, '<small>$1</small>')
    .replace(/\n/g, '<br>');
  const lines = s => s.split('\n').map(l => l.replace(/^\s*[-•]\s+/, '').trim()).filter(Boolean);
  const isDeco = n => n.nodeType === 1 && (n.tagName.toLowerCase() === 'svg' || n.getAttribute('aria-hidden') === 'true');

  function setText(el, text) {
    if (el.matches('ul, ol')) {
      const tpl = el.querySelector('li > [aria-hidden="true"]');
      el.innerHTML = '';
      lines(text).forEach((l, i) => {
        const li = document.createElement('li');
        li.innerHTML = inline(l);
        if (tpl) {
          const d = tpl.cloneNode(true);
          if (/^\d+$/.test(d.textContent.trim())) d.textContent = i + 1;
          li.prepend(d);
        }
        el.append(li);
      });
      return;
    }
    if (el.classList.contains('hero__roles')) {
      el.innerHTML = lines(text).map(inline).join(' <span>·</span> ');
      return;
    }
    if (el.classList.contains('world__chips')) {
      const items = lines(text).map(l => `<span>${inline(l)}</span>`);
      el.innerHTML = items.length > 1 ? `${items.slice(0, -1).join(' ')} &amp; ${items.at(-1)}.` : items.join('');
      return;
    }
    // Keep icons/arrows (decorations) where they were: before or after the text.
    const before = [], after = [];
    let seenText = false;
    let lastEl = null;
    el.childNodes.forEach(n => {
      if (isDeco(n)) (seenText ? after : before).push([n, lastEl && lastEl.tagName === 'BR']);
      else if (n.textContent.trim()) seenText = true;
      if (n.nodeType === 1) lastEl = n;
    });
    const counts = !!el.querySelector('[data-count]');
    el.innerHTML = inline(text);
    if (counts) el.innerHTML = el.innerHTML.replace(/\d+/, n => `<span data-count="${n}">${n}</span>`);
    before.reverse().forEach(([d]) => { el.prepend(' '); el.prepend(d); });
    after.forEach(([d, onNewLine]) => { el.append(onNewLine ? document.createElement('br') : ' '); el.append(d); });
  }

  function setLink(el, link) {
    if (!link) return;
    if (/^[^\s@/]+@[^\s@]+\.[^\s@]+$/.test(link)) link = 'mailto:' + link;
    else if (!/^(https?:|mailto:|tel:|#)/i.test(link)) link = 'https://' + link;
    el.href = link;
    el.hidden = false;
    if (link.startsWith('#') || link.startsWith('mailto:')) { el.removeAttribute('target'); el.removeAttribute('rel'); }
    else { el.target = '_blank'; el.rel = 'noopener'; }
  }

  function applyText(rows) {
    const byKey = new Map(rows.map(r => [pick(r, 'key'), r]));
    document.querySelectorAll('[data-k]').forEach(el => {
      const r = byKey.get(el.dataset.k);
      if (!r) return;
      const text = pick(r, 'text');
      if (text) setText(el, text);
      if (el.tagName === 'A') setLink(el, pick(r, 'link'));
    });
  }

  /* ---------- Timeline ---------- */
  const KINDS = {
    career:      { kind: 'career',   label: 'Career',      color: 'var(--lav-400)' },
    learning:    { kind: 'learning', label: 'Learning',    color: 'var(--mint)' },
    recognition: { kind: 'award',    label: 'Recognition', color: 'var(--gold)' },
    award:       { kind: 'award',    label: 'Recognition', color: 'var(--gold)' },
  };
  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

  function applyTimeline(rows) {
    const list = document.querySelector('ol.journey');
    rows = rows.filter(r => pick(r, 'title'));
    if (!list || !rows.length) return;
    list.innerHTML = rows.map(r => {
      const k = KINDS[pick(r, 'type').toLowerCase()] || KINDS.career;
      const special = pick(r, 'special (optional)', 'special').toLowerCase();
      let when = inline(pick(r, 'when'));
      // "May 2024 – Present" → adds a live "(2 Years 6 months)"
      const m = pick(r, 'when').match(/([A-Za-z]{3})[a-z]*\s+(\d{4}).*present/i);
      if (m && MONTHS.includes(m[1].toLowerCase())) {
        const since = `${m[2]}-${String(MONTHS.indexOf(m[1].toLowerCase()) + 1).padStart(2, '0')}`;
        when = when.replace(/present/i, p => `${p} <span data-since="${since}"></span>`);
      }
      const desc = pick(r, 'description');
      const hl = lines(pick(r, 'highlights (one per line)', 'highlights'));
      const tag = pick(r, 'tag');
      return `<li class="stop stop--${k.kind}${special === 'star' ? ' stop--star' : ''}${special === 'now' ? ' stop--now' : ''}" data-kind="${k.kind}" style="--c:${k.color}">
          <span class="stop__node">${esc(pick(r, 'year bubble', 'year'))}</span>
          <article class="stop__card"><span class="kind">${k.label}</span>
            <p class="stop__when">${when}</p>
            <h3>${inline(pick(r, 'title'))}</h3>
            ${pick(r, 'organisation') ? `<p class="stop__org">${inline(pick(r, 'organisation'))}</p>` : ''}
            ${desc ? `<p>${inline(desc)}</p>` : ''}
            ${hl.length ? `<ul class="mini-list">${hl.map(h => `<li>${inline(h)}</li>`).join('')}</ul>` : ''}
            ${tag ? `<span class="tag">${inline(tag)}</span>` : ''}
          </article>
        </li>`;
    }).join('');
  }

  /* ---------- Load, then start the page ---------- */
  async function load(url) {
    if (!url) return null;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return parseCSV(await res.text());
  }

  let started = false;
  function start() {
    started = true;
    document.documentElement.classList.remove('cms-loading');
    const s = document.createElement('script');
    s.src = 'js/main.js';
    document.body.append(s);
  }

  const timeout = new Promise(res => setTimeout(res, TIMEOUT_MS, 'timeout'));
  const work = Promise.allSettled([load(SHEET_CSV.text), load(SHEET_CSV.timeline)]).then(([t, tl]) => {
    if (started) return; // too slow — the page already started with the built-in text
    try { if (t.value) applyText(t.value); } catch (e) { console.warn('Sheet text:', e); }
    try { if (tl.value) applyTimeline(tl.value); } catch (e) { console.warn('Sheet timeline:', e); }
    [t, tl].forEach(r => r.status === 'rejected' && console.warn('Could not load sheet:', r.reason));
  });
  Promise.race([work, timeout]).finally(start);
})();
