import { createEditor, internalLinks, defaultPlugins, wordCount, type PrimavistaEditor } from '@primavista/core';

/*
 * The framework-free core, mounted by hand. A select switches themes by
 * remounting with another theme name, the way a host would configure it.
 */
const host = document.getElementById('vanilla-editor');
const output = document.getElementById('vanilla-output');
const themeSelect = document.getElementById('vanilla-theme') as HTMLSelectElement | null;
const highlight = document.getElementById('demo-highlight');

const INITIAL = `<h2>Sight-read your content</h2>
<p>This is <strong>@primavista/core</strong> without any framework. Toolbar, links, tables and alignment come from plugins. Try <code>Ctrl+K</code> on a selection, or type <code>## </code> or <code>- </code> at the start of a line.</p>
<ul><li>Plain semantic HTML on the way out</li><li>Internal links as <code>&lt;internal-link&gt;</code>, external ones as <code>&lt;a&gt;</code></li><li>Themes are CSS variables</li></ul>
<p style="text-align: center;">Centered, because alignment is a plugin too.</p>
<p>Read more on the <internal-link href="uuid-about" provider="page" target="_self" title="About">about page</internal-link>.</p>`;

let editor: PrimavistaEditor | null = null;
let html = INITIAL;

function mount(theme: string): void {
  if (!host || !output) return;
  editor?.destroy();
  editor = createEditor(host, {
    initialHtml: html,
    placeholder: 'Start writing…',
    ...(theme === 'default' ? {} : { theme }),
    plugins: [
      ...defaultPlugins(),
      internalLinks({
        providers: [
          { key: 'page', label: 'Page' },
          { key: 'media', label: 'Media' },
        ],
        defaultTarget: '_self',
      }),
      wordCount(),
    ],
  });
  output.textContent = editor.getHtml();
  editor.on('change', (next) => {
    html = next;
    output.textContent = next;
  });
  document.documentElement.dataset['theme'] = theme;
}

mount(themeSelect?.value ?? 'default');
themeSelect?.addEventListener('change', () => mount(themeSelect.value));
highlight?.addEventListener('click', () => editor?.focus());
