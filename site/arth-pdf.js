/* Planner results: "Download a PDF".
   Display only. It never computes a value: it reads the text the results page has already
   rendered and lays it out in a PDF built right here (standard Helvetica, no library, no
   network). Nothing leaves the browser. The button lives in the Workspace markup and is
   found by [data-rz-pdf]; this file never adds, removes or restyles anything on the page. */
(function () {
  'use strict';

  /* ---------------- PDF writer ---------------- */
  var PW = 595.28, PH = 841.89, MX = 42, TOP = 46, BOT = PH - 54, CW = PW - MX * 2;
  var INK = '#111316', MUTED = '#5B5E64', GOLD = '#D2B47C', GOLD_D = '#8F7444', LINE = '#E3DED2', SHADE = '#F4F1EA';

  /* Helvetica / Helvetica-Bold advance widths for chars 32..126 (per 1000 em) */
  var WR = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
  var WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
  var EXTRA = { 149: 350, 150: 556, 151: 1000, 160: 278, 183: 278, 215: 584 };

  var MAP = { '₹': 'Rs ', '‘': "'", '’': "'", '“': '"', '”': '"', '–': '\u0096', '—': '\u0097',
    '·': '·', '•': '\u0095', '−': '-', '≈': '~', '→': '->', '≥': '>=', '≤': '<=', '×': '×',
    '…': '...', ' ': ' ', ' ': ' ', ' ': ' ' };

  /* page text -> single-byte (WinAnsi) string; anything the font cannot show is dropped */
  function enc(s) {
    s = String(s).replace(/₹\s*(?=\d)/g, 'Rs ');
    var o = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s.charAt(i), c = s.charCodeAt(i);
      if (MAP[ch] !== undefined) o += MAP[ch];
      else if (c >= 32 && c <= 126) o += ch;
      else if (c === 10 || c === 13 || c === 9) o += ' ';
    }
    return o;
  }
  function cw(c, bold) {
    if (c >= 32 && c <= 126) return (bold ? WB : WR)[c - 32];
    return EXTRA[c] || 556;
  }
  function width(s, size, bold) { var w = 0; for (var i = 0; i < s.length; i++) w += cw(s.charCodeAt(i), bold); return w * size / 1000; }
  function esc(s) { return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)'); }
  function rgb(h) { return [1, 3, 5].map(function (i) { return (parseInt(h.substr(i, 2), 16) / 255).toFixed(3); }).join(' '); }
  function n2(v) { return (Math.round(v * 100) / 100).toString(); }

  function wrap(str, size, bold, maxW) {
    var words = enc(str).split(/ +/).filter(Boolean), lines = [], line = '';
    words.forEach(function (w) {
      while (width(w, size, bold) > maxW) {            // a single word wider than the box: split it
        var k = 1; while (k < w.length && width(w.slice(0, k + 1), size, bold) <= maxW) k++;
        if (line) { lines.push(line); line = ''; }
        lines.push(w.slice(0, k)); w = w.slice(k);
      }
      var t = line ? line + ' ' + w : w;
      if (width(t, size, bold) <= maxW) line = t; else { lines.push(line); line = w; }
    });
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function Doc() { this.pages = []; this.newPage(); }
  Doc.prototype.newPage = function () { this.cur = []; this.pages.push(this.cur); this.y = TOP; };
  Doc.prototype.need = function (h) { if (this.y + h > BOT) this.newPage(); };
  Doc.prototype.rect = function (x, y, w, h, col) { this.cur.push(rgb(col) + ' rg ' + n2(x) + ' ' + n2(PH - y - h) + ' ' + n2(w) + ' ' + n2(h) + ' re f'); };
  Doc.prototype.hline = function (x1, x2, y, col, lw) { this.cur.push(rgb(col) + ' RG ' + (lw || 0.6) + ' w ' + n2(x1) + ' ' + n2(PH - y) + ' m ' + n2(x2) + ' ' + n2(PH - y) + ' l S'); };
  /* s must already be enc()'d. (x, top) is the top-left of the line box. */
  Doc.prototype.text = function (s, x, top, size, bold, col, align, boxW) {
    if (!s) return;
    if (align === 'r') x = x + boxW - width(s, size, bold);
    this.cur.push('BT ' + rgb(col) + ' rg /' + (bold ? 'F2' : 'F1') + ' ' + size + ' Tf ' + n2(x) + ' ' + n2(PH - top - size * 0.86) + ' Td (' + esc(s) + ') Tj ET');
  };

  /* wrapped paragraph that may flow across pages */
  Doc.prototype.para = function (s, o) {
    o = o || {};
    var size = o.size || 9.5, lead = o.lead || size * 1.45, x = MX + (o.indent || 0), w = CW - (o.indent || 0);
    var lines = wrap(s, size, o.bold, w), self = this;
    if (o.keep) this.need(Math.min(lines.length, 3) * lead);
    lines.forEach(function (l) { self.need(lead); self.text(l, x, self.y, size, o.bold, o.col || MUTED); self.y += lead; });
    this.y += o.after === undefined ? 5 : o.after;
  };
  Doc.prototype.eyebrow = function (s) {
    this.y += 10; this.need(70);
    this.text(enc(s).toUpperCase(), MX, this.y, 7.5, true, GOLD_D); this.y += 13;
  };
  Doc.prototype.h2 = function (s) {
    var lines = wrap(s, 14, true, CW), self = this;
    this.need(lines.length * 19 + 54);
    lines.forEach(function (l) { self.text(l, MX, self.y, 14, true, INK); self.y += 19; });
    this.hline(MX, MX + CW, this.y + 2, LINE, 0.8); this.y += 10;
  };
  Doc.prototype.h3 = function (s) { this.need(40); this.y += 4; this.para(s, { size: 10, bold: true, col: INK, after: 3, keep: true }); };

  /* a row of cells: measure first so a row is never split over two pages */
  Doc.prototype.measure = function (cells, o) {
    var size = o.size || 9, lead = size * 1.4, padV = 3.5, padH = 4, x = MX, out = [], maxL = 1;
    cells.forEach(function (c, i) {
      var cwid = CW * o.cols[i], bold = o.bold || (o.boldCells && o.boldCells[i]);
      var lines = wrap(c, size, bold, cwid - padH * 2);
      out.push({ lines: lines, x: x, w: cwid, bold: bold });
      maxL = Math.max(maxL, lines.length); x += cwid;
    });
    return { cells: out, h: maxL * lead + padV * 2, lead: lead, size: size, padV: padV, padH: padH };
  };
  Doc.prototype.drawRow = function (m, o) {
    var self = this, y = this.y;
    if (o.shade) this.rect(MX, y, CW, m.h, o.shade);
    m.cells.forEach(function (c, i) {
      var al = o.align ? o.align[i] : 'l', col = (o.colors && o.colors[i]) || o.col || INK;
      c.lines.forEach(function (l, k) { self.text(l, c.x + m.padH, y + m.padV + k * m.lead, m.size, c.bold, col, al, c.w - m.padH * 2); });
    });
    this.hline(MX, MX + CW, y + m.h, LINE, 0.5);
    this.y += m.h;
  };
  Doc.prototype.row = function (cells, o) {
    var m = this.measure(cells, o);
    if (this.y + m.h > BOT) { this.newPage(); if (o.hdr) { var hm = this.measure(o.hdr.cells, o.hdr.o); this.drawRow(hm, o.hdr.o); } }
    this.drawRow(m, o);
  };

  /* key figure cards, two across */
  Doc.prototype.cards = function (items) {
    var gap = 12, w = (CW - gap) / 2, self = this;
    for (var i = 0; i < items.length; i += 2) {
      var pair = items.slice(i, i + 2).map(function (it) {
        var inner = w - 22, parts = [];
        parts.push({ lines: wrap(it.k + (it.tag ? '  -  ' + it.tag : ''), 7.5, true, inner).map(function (s) { return s.toUpperCase(); }), size: 7.5, bold: true, col: GOLD_D, lead: 11 });
        parts.push({ lines: wrap(it.v, 17, true, inner), size: 17, bold: true, col: INK, lead: 23 });
        if (it.note) parts.push({ lines: wrap(it.note, 8.5, false, inner), size: 8.5, col: MUTED, lead: 12 });
        if (it.how) parts.push({ lines: wrap(it.how, 7.5, false, inner), size: 7.5, col: MUTED, lead: 10.5, gap: 4 });
        var h = 22; parts.forEach(function (p) { h += p.lines.length * p.lead + (p.gap || 0); });
        return { parts: parts, h: h };
      });
      var rh = Math.max.apply(null, pair.map(function (p) { return p.h; }));
      this.need(rh + 10);
      pair.forEach(function (c, k) {
        var x = MX + k * (w + gap), y = self.y + 11;
        self.rect(x, self.y, w, rh, SHADE); self.rect(x, self.y, 2.5, rh, GOLD);
        c.parts.forEach(function (p) {
          y += p.gap || 0;
          p.lines.forEach(function (l) { self.text(l, x + 14, y, p.size, p.bold, p.col); y += p.lead; });
        });
      });
      this.y += rh + 10;
    }
  };

  Doc.prototype.callout = function (s) {
    var size = 9, lead = 13, lines = wrap(s, size, false, CW - 28), h = lines.length * lead + 16, self = this;
    this.need(h + 8);
    this.rect(MX, this.y, CW, h, '#FBF1DC'); this.rect(MX, this.y, 3, h, '#8A4B00');
    lines.forEach(function (l, k) { self.text(l, MX + 14, self.y + 8 + k * lead, size, false, '#4A3200'); });
    this.y += h + 8;
  };

  /* title band on page 1 */
  Doc.prototype.header = function (eyebrow, title, meta) {
    var tl = wrap(title, 19, true, CW - 8), ml = meta ? wrap(meta, 8.5, false, CW - 8) : [];
    var h = 24 + 12 + tl.length * 25 + (ml.length ? ml.length * 12 + 6 : 0) + 20, self = this;
    this.rect(0, 0, PW, h, INK); this.rect(0, h, PW, 2.5, GOLD);
    var y = 24;
    this.text(enc(eyebrow).toUpperCase(), MX, y, 8, true, GOLD); y += 18;
    tl.forEach(function (l) { self.text(l, MX, y, 19, true, '#F4F1EA'); y += 25; });
    y += 4;
    ml.forEach(function (l) { self.text(l, MX, y, 8.5, false, '#B9B6AE'); y += 12; });
    this.y = h + 18;
  };

  Doc.prototype.finish = function (info) {
    var n = this.pages.length, self = this;
    this.pages.forEach(function (ops, i) {
      self.cur = ops;
      self.hline(MX, MX + CW, PH - 38, LINE, 0.6);
      self.text(enc('Gullak - educational estimates, not investment advice'), MX, PH - 31, 7.5, false, MUTED);
      self.text('Page ' + (i + 1) + ' of ' + n, MX, PH - 31, 7.5, false, MUTED, 'r', CW);
    });
    var objs = [], P = this.pages;
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    var kids = [];
    P.forEach(function (_, i) { kids.push((6 + i * 2) + ' 0 R'); });
    objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + n + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    objs[5] = '<< /Title (' + esc(enc(info.title)) + ') /Author (Gullak) /Creator (Gullak) /Producer (Gullak) /CreationDate (' + info.date + ') >>';
    P.forEach(function (ops, i) {
      var s = ops.join('\n');
      objs[5 + i * 2 + 1] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (7 + i * 2) + ' 0 R >>';
      objs[5 + i * 2 + 2] = '<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream';
    });
    var out = '%PDF-1.4\n%âãÏÓ\n', offs = [];
    for (var k = 1; k < objs.length; k++) { offs[k] = out.length; out += k + ' 0 obj\n' + objs[k] + '\nendobj\n'; }
    var xr = out.length;
    out += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
    for (k = 1; k < objs.length; k++) out += ('0000000000' + offs[k]).slice(-10) + ' 00000 n \n';
    out += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R /Info 5 0 R >>\nstartxref\n' + xr + '\n%%EOF\n';
    var bytes = new Uint8Array(out.length);
    for (k = 0; k < out.length; k++) bytes[k] = out.charCodeAt(k) & 255;
    return bytes;
  };

  /* ---------------- read the rendered results page ---------------- */
  function clean(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  /* plain text of an element; a figure that is mid count-up reads as its final value */
  function txt(el) {
    var out = '';
    (function rec(n) {
      if (n.nodeType === 3) { out += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toLowerCase();
      if (tag === 'svg' || tag === 'script' || tag === 'style') return;
      if (n._w && n._final !== undefined && n.classList.contains('cu')) { out += n._final; return; }
      for (var c = n.firstChild; c; c = c.nextSibling) rec(c);
    })(el);
    return clean(out);
  }
  function kids(el) { return Array.prototype.slice.call(el.children); }
  function q(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }

  var SKIP = ['rz-top', 'rz-ctrl', 'rz-edit', 'gx-tip', 'gx-key', 'gx-x', 'gx-y', 'gx-yr', 'gx-wrap', 'dn-chips', 'rr-x', 'ga-eq', 'bk-bar', 'bg-bar', 'rz-bad', 'rk-b', 'pl-rows'];
  var SKIP_TAG = { svg: 1, button: 1, input: 1, script: 1, style: 1, label: 1 };

  function collect(root) {
    var B = [];
    function has(el, c) { return el.classList.contains(c); }
    function rowOf(el, o) { var c = kids(el).map(txt); B.push({ t: 'row', cells: c, o: o }); }

    function walk(el) {
      var tag = el.tagName.toLowerCase(), i;
      if (SKIP_TAG[tag]) return;
      for (i = 0; i < SKIP.length; i++) if (has(el, SKIP[i])) return;

      if (has(el, 'ap-eyebrow') || has(el, 'eyb')) { B.push({ t: 'eyebrow', s: txt(el) }); return; }
      if (tag === 'h2') { B.push({ t: 'h2', s: txt(el) }); return; }
      if (tag === 'summary') { B.push({ t: 'h3', s: txt(el) }); return; }
      if (has(el, 'rz-note')) { B.push({ t: 'callout', s: txt(el) }); return; }

      if (has(el, 'rz-ov')) {
        B.push({ t: 'cards', items: q(el, '.ov').map(function (o) {
          var g = function (s) { var x = o.querySelector(s); return x ? txt(x) : ''; };
          return { k: g('.ov-k'), tag: g('.ov-tag'), v: g('.ov-v'), note: g('.ov-n'), how: g('.ov-d p') };
        }) });
        return;
      }

      /* scenario comparison: the three columns plus their gain / return / real-value rows, as one table */
      if (has(el, 'pl')) {
        var cols = q(el, '.pl-c'), more = el.parentNode.querySelector('.pl-rows'), rows = more ? q(more, '.pl-row:not(.pl-hd)') : [];
        var hd = ['Assumption', 'Rate a year', 'Estimated value', 'Gain', 'Return', "In today's ₹"];
        var o = { cols: [0.2, 0.14, 0.2, 0.18, 0.1, 0.18], align: ['l', 'r', 'r', 'r', 'r', 'r'], size: 8.5 };
        var ho = { cols: o.cols, align: o.align, size: 8.5, bold: true, shade: SHADE };
        B.push({ t: 'row', cells: hd, o: ho });
        cols.forEach(function (c, k) {
          var r = rows[k] ? kids(rows[k]).map(txt) : ['', '', '', ''];
          var g = function (s) { var x = c.querySelector(s); return x ? txt(x) : ''; };
          var rate = g('.pl-r').replace(/\s*a year\s*$/i, '');
          B.push({ t: 'row', cells: [g('.pl-n'), rate, g('.pl-v'), r[1] || '', r[2] || '', r[3] || ''], o: { cols: o.cols, align: o.align, size: 8.5, boldCells: [true], hdr: { cells: hd, o: ho } } });
        });
        return;
      }

      if (has(el, 'tb')) {
        var trs = q(el, '.tb-r, .it-r');
        if (!trs.length) return;
        var isYear = has(trs[0], 'tb-r');
        var to = isYear ? { cols: [0.1, 0.22, 0.24, 0.24, 0.2], align: ['l', 'r', 'r', 'r', 'r'], size: 8.5 }
                        : { cols: [0.08, 0.42, 0.38, 0.12], align: ['l', 'l', 'l', 'r'], size: 8.5, colors: [GOLD_D] };
        var hdr = null;
        trs.forEach(function (tr, k) {
          var cells = kids(tr).map(txt), head = has(tr, 'tb-h');
          if (head) { var ho2 = { cols: to.cols, align: to.align, size: 8.5, bold: true, shade: SHADE }; hdr = { cells: cells, o: ho2 }; B.push({ t: 'row', cells: cells, o: ho2 }); return; }
          var oo = { cols: to.cols, align: to.align, size: 8.5, colors: to.colors, hdr: hdr || undefined };
          B.push({ t: 'row', cells: cells, o: oo });
        });
        return;
      }

      if (has(el, 'rk-bands')) {
        q(el, '.rk-b').forEach(function (b) {
          var c = kids(b).map(txt), cur = b.getAttribute('aria-current') === 'true';
          if (cur) c[0] += ' (your profile)';
          B.push({ t: 'row', cells: c, o: { cols: [0.24, 0.14, 0.62], align: ['l', 'l', 'l'], size: 8.5, boldCells: cur ? [true, true] : [true], shade: cur ? '#F4EBD6' : null } });
        });
        return;
      }

      if (has(el, 'ga')) {
        if (has(el, 'ga-min')) {
          var n = el.querySelector('.ga-n'), t = el.querySelector('.ga-t');
          if (n) B.push({ t: 'h3', s: txt(n) });
          if (t) B.push({ t: 'p', s: txt(t) });
          return;
        }
        var gn = el.querySelector('.ga-n'), gv = el.querySelector('.ga-v'), gs = el.querySelector('.ga-s'), gt = el.querySelector('.ga-t');
        B.push({ t: 'row', cells: [gn ? txt(gn) : '', gv ? txt(gv) : ''], o: { cols: [0.75, 0.25], align: ['l', 'r'], size: 10, bold: true, shade: SHADE, keep: true } });
        if (gs) B.push({ t: 'p', s: txt(gs), o: { size: 8.5, after: 2 } });
        if (gt) B.push({ t: 'p', s: txt(gt) });
        return;
      }

      if (has(el, 'rk-f')) { rowOf(el, { cols: [0.12, 0.88], align: ['l', 'l'], size: 8.5, colors: [GOLD_D] }); return; }
      if (has(el, 'bk-r') || has(el, 'bk-rl')) { rowOf(el, { cols: [0.72, 0.28], align: ['l', 'r'], size: 9, bold: has(el, 'bk-t') }); return; }
      if (has(el, 'dn-h')) { rowOf(el, { cols: [0.7, 0.3], align: ['l', 'r'], size: 9.5, bold: true, noRule: true }); return; }
      if (has(el, 'dn-s')) { rowOf(el, { cols: [0.7, 0.3], align: ['l', 'r'], size: 8.5, col: MUTED }); return; }
      if (has(el, 'bg-l')) { B.push({ t: 'h3', s: txt(el) }); return; }

      if (tag === 'ol') { q(el, 'li').forEach(function (li, k) { B.push({ t: 'p', s: (k + 1) + '.  ' + txt(li), o: { indent: 10 } }); }); return; }
      if (tag === 'p' || has(el, 'rk-req') || has(el, 'rk-warn') || has(el, 'cn-src') || has(el, 'ga-s')) {
        var s = txt(el); if (s) B.push({ t: 'p', s: s, o: has(el, 'cn-src') || has(el, 'rk-warn') ? { size: 8.5, after: 7 } : null });
        return;
      }
      kids(el).forEach(walk);
    }
    walk(root);
    return B;
  }

  /* ---------------- build + download ---------------- */
  function build(rz) {
    var h1 = document.getElementById('rz-h'), sub = rz.querySelector('.rz-sub');
    var pv = document.getElementById('rz-pv'), yrs = document.querySelector('label[for="rz-yrs"] .rz-cv');
    var sel = rz.querySelector('.rz-sg[aria-pressed="true"]');
    var meta = [];
    if (pv && pv.value) meta.push('Amount invested: ₹' + clean(pv.value).replace(/^₹\s*/, ''));
    if (yrs) meta.push('Horizon: ' + txt(yrs));
    if (sel) meta.push('Assumption shown: ' + clean(Array.prototype.slice.call(sel.children).filter(function (c) { return c.tagName !== 'I'; }).map(txt).join(' ')));
    var now = new Date(), p2 = function (v) { return ('0' + v).slice(-2); };
    meta.push('Created ' + now.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()] + ' ' + now.getFullYear());

    var d = new Doc();
    d.header('Gullak - your results', h1 ? txt(h1) : 'Your results', meta.join('   |   '));
    if (sub && txt(sub)) d.para(txt(sub), { size: 10, after: 8 });

    collect(rz).forEach(function (b) {
      if (b.t === 'eyebrow') d.eyebrow(b.s);
      else if (b.t === 'h2') d.h2(b.s);
      else if (b.t === 'h3') d.h3(b.s);
      else if (b.t === 'p') d.para(b.s, b.o || {});
      else if (b.t === 'callout') d.callout(b.s);
      else if (b.t === 'cards') d.cards(b.items);
      else if (b.t === 'row') d.row(b.cells.map(enc), b.o);
    });

    var date = now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + p2(now.getHours()) + p2(now.getMinutes()) + p2(now.getSeconds());
    return {
      bytes: d.finish({ title: 'Gullak results', date: 'D:' + date }),
      name: 'Gullak-results-' + now.getFullYear() + '-' + p2(now.getMonth() + 1) + '-' + p2(now.getDate()) + '.pdf'
    };
  }

  var busy = false;
  function download() {
    if (busy) return;
    var rz = document.querySelector('.rz');
    if (!rz || !rz.querySelector('.rz-ov')) return;          // results are paused or not shown: nothing to export
    busy = true;
    try {
      var r = build(rz);
      var url = URL.createObjectURL(new Blob([r.bytes], { type: 'application/pdf' }));
      var a = document.createElement('a');
      a.href = url; a.download = r.name; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 4000);
    } catch (e) {
      if (window.console) console.error('Gullak PDF:', e);
      alert('Sorry, the PDF could not be created. Please try again.');
    }
    setTimeout(function () { busy = false; }, 800);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rz-pdf]');
    if (b) { e.preventDefault(); download(); }
  });

  if (window.__arthPdfTest) window.__arthPdfTest(build, collect);
})();
