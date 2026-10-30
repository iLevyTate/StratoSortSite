// Renders the StratoSort Stack documentation (Markdown in
// iLevyTate/StratoSortStack/docs) into plain static HTML that uses this site's
// design. No Jekyll: the few Jekyll-only constructs the docs use (front matter,
// {% include figure %}, {% include feature_row %}, {% raw %}, {{ site.baseurl }},
// kramdown {: .notice--x} callouts) are translated here.
//
// Usage: node scripts/build-docs.mjs --src <docs dir> --out <output dir>
import fs from 'node:fs';
import path from 'node:path';
import { Marked } from 'marked';
import YAML from 'yaml';

const REPO = 'iLevyTate/StratoSortStack';
const BASE = '/docs';
const ORIGIN = 'https://stratosort.com';
const OLD_SITE = 'https://ilevytate.github.io/StratoSortStack';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, arg, i, all) => {
    if (arg.startsWith('--')) pairs.push([arg.slice(2), all[i + 1]]);
    return pairs;
  }, [])
);
if (!args.src || !args.out) {
  console.error('usage: build-docs.mjs --src <docs dir> --out <output dir>');
  process.exit(2);
}
const SRC = path.resolve(args.src);
const OUT = path.resolve(args.out);

const config = YAML.parse(fs.readFileSync(path.join(SRC, '_config.yml'), 'utf8')) || {};
const nav = YAML.parse(fs.readFileSync(path.join(SRC, '_data/navigation.yml'), 'utf8')) || {};
// Jekyll skips _-prefixed and dot paths; _config.yml lists the rest. The theme's
// stylesheet override only applies to the old Jekyll theme.
const excluded = [...(config.exclude || []), 'assets/css'];
const isExcluded = (rel) =>
  rel.split('/').some((part) => part.startsWith('_') || part.startsWith('.')) ||
  excluded.some((ex) => rel === ex || rel.startsWith(`${ex}/`));

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
const stripTags = (s) => decodeEntities(s.replace(/<[^>]+>/g, ''));
const navUrl = (url) => (/^https?:/.test(url) ? url : `${BASE}${url}`);

function walk(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (isExcluded(childRel)) return [];
    return entry.isDirectory() ? walk(path.join(dir, entry.name), childRel) : [childRel];
  });
}

function splitFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  return { data: YAML.parse(m[1]) || {}, body: text.slice(m[0].length) };
}

const includeAttrs = (tag) =>
  Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

function featureCards(items = []) {
  const cards = items
    .map(
      (f) => `<a class="card" href="${escapeHtml(navUrl(f.url))}">
  <img src="${escapeHtml(navUrl(f.image_path))}" alt="${escapeHtml(f.alt || '')}" loading="lazy">
  <span class="card-t">${escapeHtml(f.title)}</span>
  <span class="card-x">${escapeHtml(f.excerpt)}</span>
  <span class="card-l">${escapeHtml(f.btn_label || 'Read more')} →</span>
</a>`
    )
    .join('\n');
  return `\n<div class="cards">\n${cards}\n</div>\n`;
}

// Translate the Jekyll/kramdown-only syntax into Markdown + HTML.
function preprocess(md, data) {
  md = md.replace(/^\s*\{%-?\s*(raw|endraw)\s*-?%\}\s*$/gm, '');
  md = md.replace(/\{%\s*include\s+figure\b([^%]*)%\}/g, (_, attrs) => {
    const a = includeAttrs(attrs);
    const caption = a.caption ? `<figcaption>${escapeHtml(a.caption)}</figcaption>` : '';
    return `<figure><img src="${escapeHtml(navUrl(a.image_path))}" alt="${escapeHtml(a.alt || '')}" loading="lazy">${caption}</figure>`;
  });
  md = md.replace(/\{%\s*include\s+feature_row\b([^%]*)%\}/g, (_, attrs) =>
    featureCards(data[includeAttrs(attrs).id || 'feature_row'])
  );
  md = md.replace(/\{\{\s*site\.baseurl\s*\}\}/g, BASE);
  md = md.replace(/\{\{\s*'([^']*)'\s*\|\s*relative_url\s*\}\}/g, (_, p) => `${BASE}${p}`);

  // kramdown block IAL: "{: .notice--info}" styles the block directly above it.
  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const ial = lines[i].match(/^\{:\s*\.notice(?:--(\w+))?\s*\}\s*$/);
    if (!ial) continue;
    let start = i;
    while (start > 0 && lines[start - 1].trim() !== '') start--;
    const kind = ial[1] || 'info';
    lines.splice(i, 1, '', '</div>');
    lines.splice(start, 0, `<div class="callout callout-${kind}">`, '');
    i += 2;
  }
  md = lines.join('\n');

  const leftover = md.replace(/```[\s\S]*?```/g, '').match(/\{%[^%]*%\}/g);
  if (leftover) console.warn(`  unhandled Liquid: ${[...new Set(leftover)].join(', ')}`);
  return md;
}

// GitHub-style heading ids, so links written for github.com keep working.
function slugger() {
  const seen = new Map();
  return (text) => {
    let slug = text
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .replace(/\s/g, '-');
    const n = seen.get(slug) || 0;
    seen.set(slug, n + 1);
    return n ? `${slug}-${n}` : slug;
  };
}

function rewriteUrl(url, pageRel, attr) {
  if (url.startsWith(OLD_SITE)) url = BASE + (url.slice(OLD_SITE.length) || '/');
  // A GitHub link to a published docs page stays on this site.
  const ghDoc = url.match(new RegExp(`^https://github\\.com/${REPO}/blob/main/docs/([^#]+\\.md)(#.*)?$`, 'i'));
  if (ghDoc && !isExcluded(ghDoc[1]) && fs.existsSync(path.join(SRC, ghDoc[1]))) {
    url = `/${ghDoc[1]}${ghDoc[2] || ''}`;
  }
  if (/^(https?:|mailto:|tel:|data:|#|\/\/)/.test(url)) return url;
  const [, target, hash = ''] = url.match(/^([^#]*)(#.*)?$/);
  if (!target) return url;
  if (target.startsWith(`${BASE}/`) || target === BASE) return url;

  const docRel = target.startsWith('/')
    ? target.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(pageRel), target));
  const repoPath = path.posix.normalize(path.posix.join('docs', docRel));
  if (docRel.startsWith('..') || isExcluded(docRel.replace(/\/$/, ''))) {
    const kind = attr === 'href' ? 'blob' : 'raw';
    return `https://github.com/${REPO}/${kind}/main/${repoPath.replace(/^(\.\.\/)+/, '')}${hash}`;
  }
  const abs = path.join(SRC, docRel);
  if (docRel !== '.' && fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    return `https://github.com/${REPO}/tree/main/${repoPath.replace(/\/$/, '')}${hash}`;
  }
  if (/\.md$/i.test(docRel)) {
    if (fs.existsSync(abs)) {
      const html = docRel.replace(/(^|\/)index\.md$/i, '$1').replace(/\.md$/i, '.html');
      return `${BASE}/${html}${hash}`;
    }
    return `https://github.com/${REPO}/blob/main/${repoPath}${hash}`;
  }
  // Jekyll-era links name the rendered page ("INSTALL_GUIDE.html").
  if (/\.html$/i.test(docRel) && fs.existsSync(abs.replace(/\.html$/i, '.md'))) {
    return `${BASE}/${docRel}${hash}`;
  }
  if (docRel !== '' && !fs.existsSync(abs)) {
    return `https://github.com/${REPO}/${attr === 'href' ? 'blob' : 'raw'}/main/${repoPath}${hash}`;
  }
  return `${BASE}/${docRel}${target.endsWith('/') && docRel ? '/' : ''}${hash}`;
}

function postprocess(html, pageRel) {
  const slug = slugger();
  html = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_, level, inner) => {
    const id = slug(stripTags(inner));
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  html = html.replace(/\b(href|src|poster)="([^"]*)"/g, (_, attr, url) => {
    return `${attr}="${escapeHtml(rewriteUrl(decodeEntities(url), pageRel, attr))}"`;
  });
  html = html.replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>');
  return html;
}

const marked = new Marked({ gfm: true });

function navHtml(currentUrl) {
  const sections = (nav.docs || [])
    .map((section) => {
      const items = (section.children || [])
        .map((child) => {
          const href = navUrl(child.url);
          const current = href === currentUrl ? ' aria-current="page"' : '';
          return `<li><a href="${escapeHtml(href)}"${current}>${escapeHtml(child.title)}</a></li>`;
        })
        .join('');
      return `<p class="side-h">${escapeHtml(section.title)}</p><ul>${items}</ul>`;
    })
    .join('\n');
  return sections;
}

function sectionFor(url) {
  for (const section of nav.docs || []) {
    if ((section.children || []).some((c) => navUrl(c.url) === url)) return section.title;
  }
  return 'Documentation';
}

const topLinks = (nav.main || [])
  .filter((l) => !/stratosort\.com/.test(l.url))
  .map((l) => {
    const ext = /^https?:/.test(l.url) ? ' rel="noopener noreferrer"' : '';
    return `<li><a href="${escapeHtml(navUrl(l.url))}"${ext}>${escapeHtml(l.title)}</a></li>`;
  })
  .join('');

function page({ title, description, url, bodyHtml, sourceRel, hero }) {
  const sideNav = navHtml(url);
  const crumb = url === `${BASE}/` ? 'Documentation' : sectionFor(url);
  const heading = hero
    ? `<h1>${escapeHtml(title)} <em>Docs</em></h1>${hero}`
    : `<h1>${escapeHtml(title)}</h1>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)} · StratoSort Docs</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="theme-color" content="#070C12">
<meta name="color-scheme" content="dark">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'">
<link rel="canonical" href="${ORIGIN}${escapeHtml(url)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="StratoSort">
<meta property="og:title" content="${escapeHtml(title)} · StratoSort Docs">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${ORIGIN}${escapeHtml(url)}">
<meta property="og:image" content="${ORIGIN}/assets/og-image.png">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;1,9..40,400&family=JetBrains+Mono:wght@400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/docs.css">
</head>
<body>
<a class="skip" href="#content">Skip to content</a>
<header class="top">
  <div class="top-in">
    <a href="/" class="top-mark" aria-label="StratoSort home"><img src="/assets/StratoSortCoreLogo.svg" alt=""></a>
    <a href="${BASE}/" class="top-docs">Docs</a>
    <ul class="top-links">${topLinks}</ul>
  </div>
</header>
<div class="layout">
  <aside class="side" aria-label="Documentation">
    <details class="side-m"><summary>Documentation menu</summary><nav>${sideNav}</nav></details>
    <nav class="side-d">${sideNav}</nav>
  </aside>
  <main id="content" class="doc">
    <p class="crumb">${escapeHtml(crumb)}</p>
    ${heading}
${bodyHtml}
    <p class="edit"><a href="https://github.com/${REPO}/edit/main/docs/${escapeHtml(sourceRel)}" rel="noopener noreferrer">Edit this page on GitHub</a></p>
  </main>
</div>
<footer>
  <div class="footer-inner">
    <span class="footer-co">&copy; ${new Date().getUTCFullYear()} Kennedy Applied Sciences, Inc. &middot; StratoSort</span>
    <div class="footer-links">
      <a href="/">Home</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="https://github.com/${REPO}" rel="noopener noreferrer">GitHub</a>
      <a href="mailto:contact@kennedyappliedsciences.com">Contact</a>
    </div>
  </div>
</footer>
</body>
</html>
`;
}

function describe(data, html) {
  const text = data.excerpt || data.description || stripTags((html.match(/<p>([\s\S]*?)<\/p>/) || [])[1] || '');
  const flat = String(text).replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 157).replace(/\s+\S*$/, '')}…` : flat;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const files = walk(SRC);
const pages = [];
for (const rel of files) {
  if (!/\.md$/i.test(rel)) {
    if (rel === '_config.yml') continue;
    fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
    fs.copyFileSync(path.join(SRC, rel), path.join(OUT, rel));
    continue;
  }
  const { data, body } = splitFrontMatter(fs.readFileSync(path.join(SRC, rel), 'utf8'));
  let bodyHtml = postprocess(marked.parse(preprocess(body, data)), rel);
  let title = data.title;
  const h1 = bodyHtml.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>\s*/);
  if (h1) {
    title = title || stripTags(h1[1]);
    bodyHtml = bodyHtml.slice(h1[0].length);
  }
  title = title || path.basename(rel, '.md').replace(/_/g, ' ');

  const isHome = rel === 'index.md';
  const outRel = isHome ? 'index.html' : rel.replace(/\.md$/i, '.html');
  const url = isHome ? `${BASE}/` : `${BASE}/${outRel}`;
  let hero = '';
  if (isHome) {
    const actions = (data.header?.actions || [])
      .map(
        (a, i) =>
          `<a class="btn${i ? '' : ' btn-p'}" href="${escapeHtml(navUrl(a.url))}">${escapeHtml(a.label)}</a>`
      )
      .join('');
    hero = `<p class="lede">${escapeHtml(data.excerpt || '')}</p><p class="actions">${actions}</p>`;
    title = data.title || 'StratoSort Stack';
  }
  const html = page({
    title,
    description: describe(data, bodyHtml),
    url,
    bodyHtml,
    sourceRel: rel,
    hero,
  });
  fs.mkdirSync(path.dirname(path.join(OUT, outRel)), { recursive: true });
  fs.writeFileSync(path.join(OUT, outRel), html);
  pages.push(url);
}

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .sort()
  .map((u) => `  <url><loc>${ORIGIN}${u}</loc><lastmod>${today}</lastmod></url>`)
  .join('\n')}
</urlset>
`
);
console.log(`Rendered ${pages.length} pages and copied ${files.length - pages.length} assets to ${OUT}`);
