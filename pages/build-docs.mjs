/*
 * Renders the repository's Markdown into static pages under dist/docs.
 * Relative links between the documents are rewritten to the rendered pages,
 * everything else points at the file on GitHub.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const out = join(here, 'dist', 'docs');
const repo = 'https://github.com/wachterjohannes/primavista/blob/main/';

/** Source file (repo relative) → output page and navigation. */
const DOCS = [
  { src: 'README.md', slug: 'index', title: 'Overview', group: 'Start' },
  { src: 'packages/core/README.md', slug: 'core', title: '@primavista/core', group: 'Packages' },
  { src: 'packages/react/README.md', slug: 'react', title: '@primavista/react', group: 'Packages' },
  { src: 'packages/sulu/README.md', slug: 'sulu', title: '@primavista/sulu', group: 'Packages' },
  { src: 'bundle/README.md', slug: 'symfony-ux', title: 'Symfony UX bundle', group: 'Packages' },
  { src: 'docs/sulu-integration.md', slug: 'sulu-integration', title: 'Replacing CKEditor in Sulu', group: 'Sulu' },
  { src: 'docs/sulu-requirements.md', slug: 'sulu-requirements', title: 'What Sulu uses from CKEditor', group: 'Sulu' },
  { src: 'DECISIONS.md', slug: 'decisions', title: 'Decisions', group: 'Background' },
  { src: 'RESEARCH.md', slug: 'research', title: 'Research', group: 'Background' },
  { src: 'IDEA.md', slug: 'idea', title: 'The idea', group: 'Background' },
  { src: 'NAME.md', slug: 'name', title: 'Why the name', group: 'Background' },
  { src: 'docs/interviews/2026-09-24-kickoff.md', slug: 'kickoff-interview', title: 'Kickoff interview', group: 'Background' },
  { src: 'CONTRIBUTING.md', slug: 'contributing', title: 'Contributing', group: 'Project' },
];

const bySource = new Map(DOCS.map((doc) => [doc.src, doc]));

function rewriteLink(href, doc) {
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  const [path, hash = ''] = href.split('#');
  const target = posix.normalize(posix.join(posix.dirname(doc.src), path));
  const known = bySource.get(target);
  if (known) return `${known.slug}.html${hash ? `#${hash}` : ''}`;
  if (target.startsWith('docs/assets/')) return `../assets/${posix.basename(target)}`;
  return repo + target;
}

function render(doc) {
  // Raw HTML in the Markdown (the README header) goes through marked untouched,
  // so its attributes are rewritten up front.
  const source = readFileSync(join(root, doc.src), 'utf8').replace(
    /(href|src)="([^"]+)"/g,
    (_match, attribute, href) => `${attribute}="${rewriteLink(href, doc)}"`,
  );
  const renderer = new marked.Renderer();
  const link = renderer.link.bind(renderer);
  const image = renderer.image.bind(renderer);
  renderer.link = (token) => link({ ...token, href: rewriteLink(token.href, doc) });
  renderer.image = (token) => image({ ...token, href: rewriteLink(token.href, doc) });
  renderer.heading = ({ tokens, depth }) => {
    const text = renderer.parser.parseInline(tokens);
    const id = text
      .replace(/<[^>]+>/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  return marked.parse(source, { renderer, gfm: true });
}

function nav(current) {
  const groups = [];
  for (const doc of DOCS) {
    let group = groups.find((g) => g.name === doc.group);
    if (!group) groups.push((group = { name: doc.group, docs: [] }));
    group.docs.push(doc);
  }
  return groups
    .map(
      (group) =>
        `<div class="nav-group"><div class="nav-title">${group.name}</div>` +
        group.docs
          .map((doc) => `<a href="${doc.slug}.html"${doc.slug === current.slug ? ' aria-current="page"' : ''}>${doc.title}</a>`)
          .join('') +
        '</div>',
    )
    .join('');
}

function page(doc, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${doc.title} · Primavista</title>
  <link rel="icon" href="../assets/logo.svg">
  <link rel="stylesheet" href="../site.css">
  <link rel="stylesheet" href="../docs.css">
</head>
<body class="docs-body">
  <header class="docs-header">
    <a class="docs-brand" href="../"><img src="../assets/logo.svg" alt="" width="28" height="28"> Primavista</a>
    <nav class="docs-top"><a href="../">Demo</a><a href="index.html">Docs</a><a href="https://github.com/wachterjohannes/primavista">GitHub</a></nav>
  </header>
  <div class="docs-layout">
    <aside class="docs-nav">${nav(doc)}</aside>
    <main class="docs-main">
      <article class="markdown">${body}</article>
      <p class="docs-edit"><a href="${repo}${doc.src}">Edit this page on GitHub</a></p>
    </main>
  </div>
</body>
</html>
`;
}

mkdirSync(out, { recursive: true });
for (const doc of DOCS) {
  writeFileSync(join(out, `${doc.slug}.html`), page(doc, render(doc)));
}
for (const asset of ['screenshot.png', 'sulu-screencast.mp4', 'sulu-screencast.gif', 'sulu-screencast.png']) {
  copyFileSync(join(root, 'docs', 'assets', asset), join(here, 'dist', 'assets', asset));
}
copyFileSync(join(here, 'public', 'docs.css'), join(here, 'dist', 'docs.css'));
console.log(`docs: ${DOCS.length} pages`);
