/* Sangeetha — More than a Title
   Small, dependency-free interactions. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Top bar + chapter rail ---------- */
  const topbar = $('#topbar');
  const rail = $('.rail');
  const hero = $('#intro');
  const footer = $('.footer');
  const chapters = $$('.chapter');
  const railLinks = $$('[data-rail]');
  let lastChapter = null;
  let flashTimer = null;

  function onScroll() {
    const y = scrollY;
    topbar.classList.toggle('is-solid', y > 40);

    const heroEnd = hero.offsetHeight * 0.8;
    const pastFooter = footer.getBoundingClientRect().top < innerHeight * 0.6;
    rail.classList.toggle('is-visible', y > heroEnd && !pastFooter);

    let current = null;
    for (const ch of chapters) {
      if (ch.getBoundingClientRect().top <= innerHeight * 0.4) current = ch;
    }
    railLinks.forEach(a => a.classList.toggle('is-active', current && a.dataset.rail === current.id));
    rail.classList.toggle('on-dark', !!current && current.classList.contains('dark'));

    // Briefly show the chapter name when a new chapter scrolls in, then tuck it away.
    const currentId = current ? current.id : null;
    if (currentId !== lastChapter) {
      lastChapter = currentId;
      clearTimeout(flashTimer);
      railLinks.forEach(a => a.classList.remove('is-flash'));
      const link = currentId && railLinks.find(a => a.dataset.rail === currentId);
      if (link && rail.classList.contains('is-visible')) {
        link.classList.add('is-flash');
        flashTimer = setTimeout(() => link.classList.remove('is-flash'), 1400);
      }
    }

    drawJourneyProgress();
  }
  let ticking = false;
  addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(() => { onScroll(); ticking = false; }); ticking = true; }
  }, { passive: true });

  /* ---------- Mobile chapter menu ---------- */
  const menuBtn = $('#menuBtn');
  const menu = $('#menu');
  function setMenu(open) {
    menuBtn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  }
  menuBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  /* ---------- Reveal on scroll + counters ---------- */
  function countUp(el) {
    const target = +el.dataset.count;
    if (reduceMotion) { el.textContent = target; return; }
    const start = performance.now(), dur = 1400;
    const step = t => {
      const p = Math.min(1, (t - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      $$('[data-count]', en.target).forEach(countUp);
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach((el, i) => {
    // small stagger for siblings
    const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
    el.style.transitionDelay = `${Math.min(sibs.indexOf(el), 6) * 70}ms`;
    io.observe(el);
  });

  /* ---------- Tabs (Chapter 4) ---------- */
  const tabs = $$('[role="tab"]');
  function selectTab(tab) {
    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      $('#' + t.getAttribute('aria-controls')).hidden = !on;
    });
    buildJourneys();
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      next.focus(); selectTab(next);
    });
  });

  /* ---------- Winding journey path ---------- */
  const SVGNS = 'http://www.w3.org/2000/svg';
  const journeys = [];

  function buildJourney(list, idx) {
    if (list.offsetParent === null) return; // hidden panel
    let svg = $('.journey__path', list);
    if (!svg) {
      svg = document.createElementNS(SVGNS, 'svg');
      svg.classList.add('journey__path');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = `<defs><linearGradient id="jg${idx}" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#c3aef0"/><stop offset=".35" stop-color="#eaa0bd"/>
          <stop offset=".7" stop-color="#e3bd74"/><stop offset="1" stop-color="#9a7fe0"/></linearGradient></defs>
        <path class="track" stroke="rgba(34,26,44,.08)"/><path class="ink" stroke="url(#jg${idx})"/>`;
      list.prepend(svg);
    }
    const box = list.getBoundingClientRect();
    const pts = $$('.stop__node', list).map(n => {
      const r = n.getBoundingClientRect();
      return [r.left - box.left + r.width / 2, r.top - box.top + r.height / 2];
    });
    if (pts.length < 2) return;
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const dy = (y1 - y0) * 0.55;
      d += ` C${x0},${y0 + dy} ${x1},${y1 - dy} ${x1},${y1}`;
    }
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const grad = $('linearGradient', svg);
    grad.setAttribute('x1', 0); grad.setAttribute('x2', 0);
    grad.setAttribute('y1', pts[0][1]); grad.setAttribute('y2', pts[pts.length - 1][1]);
    const [track, ink] = $$('path', svg);
    track.setAttribute('d', d);
    ink.setAttribute('d', d);
    const len = ink.getTotalLength();
    ink.style.strokeDasharray = len;
    journeys[idx] = { list, ink, len };
  }
  function buildJourneys() {
    $$('.journey').forEach(buildJourney);
    drawJourneyProgress();
  }
  function drawJourneyProgress() {
    journeys.forEach(j => {
      if (!j || j.list.offsetParent === null) return;
      if (reduceMotion) { j.ink.style.strokeDashoffset = 0; return; }
      const r = j.list.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight * 0.75 - r.top) / r.height));
      j.ink.style.strokeDashoffset = j.len * (1 - p);
    });
  }
  new ResizeObserver(buildJourneys).observe(document.body);

  /* ---------- Skills network (Chapter 3) ---------- */
  const CATS = {
    strategy:   { label: 'People Strategy', color: '#c3aef0' },
    leadership: { label: 'Leadership & Transformation', color: '#eaa0bd' },
    ops:        { label: 'Operational Excellence', color: '#e3bd74' },
    tech:       { label: 'Technology & Innovation', color: '#8fd2bc' },
  };

  function buildGraph() {
    const svg = $('#skillGraph');
    if (!svg) return;

    // Read skills from the visible lists so content lives in one place.
    const nodes = [{ id: 'core', label: 'My toolkit', type: 'core', r: 58, x: 0, y: 0 }];
    const links = [];
    const angles = { strategy: -2.45, leadership: -0.7, ops: 2.45, tech: 0.7 };
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    $$('.skill-list').forEach(list => {
      const cat = list.dataset.cat;
      const a = angles[cat];
      const hub = { id: cat, label: CATS[cat].label, type: 'hub', cat, r: 30, x: Math.cos(a) * 400, y: Math.sin(a) * 150 };
      nodes.push(hub);
      links.push([nodes[0], hub]);
      const items = $$('li', list);
      items.forEach((li, i) => {
        const spread = (i / (items.length - 1) - 0.5) * 2.4;
        const sa = a + spread;
        const n = {
          id: `${cat}-${i}`, label: li.textContent.trim(), type: 'skill', cat,
          r: 7 + rand() * 4,
          x: hub.x + Math.cos(sa) * (190 + rand() * 60),
          y: hub.y + Math.sin(sa) * (100 + rand() * 40),
          li,
        };
        nodes.push(n);
        links.push([hub, n]);
      });
    });

    // Label sizes for collision boxes
    nodes.forEach(n => {
      const px = n.type === 'hub' ? 9 : n.type === 'core' ? 0 : 7.4;
      n.hw = Math.max(n.r, (n.label.length * px) / 2) + 8;
      n.top = n.r + 6;
      n.bot = n.type === 'core' ? n.r + 6 : n.r + (n.type === 'hub' ? 30 : 22);
    });

    // Tiny force simulation: springs, repulsion, label-box collision.
    const ITER = 520;
    for (let it = 0; it < ITER; it++) {
      const alpha = 1 - it / ITER;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y;
          const d2 = Math.max(dx * dx + dy * dy, 1), d = Math.sqrt(d2);
          const f = (2600 / d2) * alpha;
          dx /= d; dy /= d;
          if (a.type !== 'core') { a.x -= dx * f; a.y -= dy * f; }
          if (b.type !== 'core') { b.x += dx * f; b.y += dy * f; }

          // box collision (labels sit under the dot)
          const ox = a.hw + b.hw - Math.abs(b.x - a.x);
          const aTop = a.y - a.top, aBot = a.y + a.bot, bTop = b.y - b.top, bBot = b.y + b.bot;
          const oy = Math.min(aBot, bBot) - Math.max(aTop, bTop);
          if (ox > 0 && oy > 0) {
            const wa = a.type === 'core' ? 0 : b.type === 'core' ? 1 : 0.5;
            const wb = 1 - wa;
            if (ox < oy) {
              const s = Math.sign(b.x - a.x) || 1;
              a.x -= s * ox * wa; b.x += s * ox * wb;
            } else {
              const s = Math.sign(b.y - a.y) || 1;
              a.y -= s * oy * wa; b.y += s * oy * wb;
            }
          }
        }
      }
      links.forEach(([a, b]) => {
        const L = a.type === 'core' ? 300 : 140;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        const k = ((d - L) / d) * 0.06 * alpha;
        if (a.type !== 'core') { a.x += dx * k; a.y += dy * k; }
        b.x -= dx * k; b.y -= dy * k;
      });
      nodes.forEach(n => { if (n.type !== 'core') { n.x *= 1 - 0.002 * alpha; n.y *= 1 - 0.035 * alpha; } });
    }

    // Fit the drawing
    const minX = Math.min(...nodes.map(n => n.x - n.hw)) - 10;
    const maxX = Math.max(...nodes.map(n => n.x + n.hw)) + 10;
    const minY = Math.min(...nodes.map(n => n.y - n.top)) - 10;
    const maxY = Math.max(...nodes.map(n => n.y + n.bot)) + 10;
    svg.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);

    const color = n => (n.type === 'core' ? '#e6dcfa' : CATS[n.cat].color);
    const linkEls = links.map(([a, b]) => {
      const l = document.createElementNS(SVGNS, 'line');
      l.setAttribute('class', 'lk');
      l.setAttribute('x1', a.x); l.setAttribute('y1', a.y);
      l.setAttribute('x2', b.x); l.setAttribute('y2', b.y);
      l.style.setProperty('--lit', color(b));
      l._ends = [a, b];
      svg.appendChild(l);
      return l;
    });
    nodes.forEach((n, i) => {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', `nd nd--${n.type}`);
      g.style.setProperty('--d', `${n.type === 'core' ? 0 : n.type === 'hub' ? 150 : 300 + i * 18}ms`);
      g.style.setProperty('--lit', color(n));
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', n.x); c.setAttribute('cy', n.y); c.setAttribute('r', n.r);
      c.setAttribute('fill', color(n));
      if (n.type === 'hub') { c.setAttribute('stroke', 'rgba(255,255,255,.35)'); c.setAttribute('stroke-width', 6); c.setAttribute('paint-order', 'stroke'); }
      const t = document.createElementNS(SVGNS, 'text');
      t.textContent = n.label;
      t.setAttribute('x', n.x);
      t.setAttribute('y', n.type === 'core' ? n.y + 7 : n.y + n.r + (n.type === 'hub' ? 24 : 17));
      g.append(c, t);
      g._node = n;
      n.el = g;
      svg.appendChild(g);
    });

    // Focus behaviour
    let pinned = null;
    function focus(test) {
      svg.classList.add('is-focus');
      nodes.forEach(n => n.el.classList.toggle('is-lit', test(n)));
      linkEls.forEach(l => l.classList.toggle('is-lit', test(l._ends[0]) && test(l._ends[1])));
    }
    function clear() {
      if (pinned) return focusCat(pinned);
      svg.classList.remove('is-focus');
      $$('.is-lit', svg).forEach(e => e.classList.remove('is-lit'));
    }
    const focusCat = cat => focus(n => n.type === 'core' || n.cat === cat);
    function focusNode(n) {
      if (n.type === 'core') return clear();
      if (n.type === 'hub') return focusCat(n.cat);
      focus(m => m === n || (m.type === 'hub' && m.cat === n.cat) || m.type === 'core');
    }
    nodes.forEach(n => {
      n.el.addEventListener('mouseenter', () => focusNode(n));
      n.el.addEventListener('mouseleave', clear);
      n.el.addEventListener('click', () => {
        if (n.type === 'hub') setPinned(pinned === n.cat ? null : n.cat);
      });
      if (n.li) {
        n.li.addEventListener('mouseenter', () => focusNode(n));
        n.li.addEventListener('mouseleave', clear);
      }
    });

    const legend = $$('.graph__legend button');
    function setPinned(cat) {
      pinned = cat;
      legend.forEach(b => b.setAttribute('aria-pressed', b.dataset.cat === cat));
      cat ? focusCat(cat) : clear();
    }
    legend.forEach(b => {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', () => setPinned(pinned === b.dataset.cat ? null : b.dataset.cat));
      b.addEventListener('mouseenter', () => focusCat(b.dataset.cat));
      b.addEventListener('mouseleave', clear);
    });
  }

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  const lbImg = $('img', lb);
  const lbCap = $('figcaption', lb);
  let lastFocus = null;
  function openLb(src, cap) {
    lastFocus = document.activeElement;
    lbImg.src = src;
    lbImg.alt = cap;
    lbCap.textContent = cap;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.lightbox__close', lb).focus();
  }
  function closeLb() {
    lb.hidden = true;
    lbImg.removeAttribute('src');
    document.body.style.overflow = '';
    lastFocus && lastFocus.focus();
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-lightbox]');
    if (!a) return;
    e.preventDefault();
    openLb(a.getAttribute('href'), a.dataset.lightbox);
  });
  lb.addEventListener('click', e => { if (e.target !== lbImg) closeLb(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

  /* ---------- Init ---------- */
  $('#year').textContent = new Date().getFullYear();
  buildGraph();
  addEventListener('load', buildJourneys);
  buildJourneys();
  onScroll();
})();
