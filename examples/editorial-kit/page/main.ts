import { createEditor, defaultPlugins } from '@primavista/core';
import { editorialKit } from '../src';

/** A page for the browser tests: the kit in an editor and its HTML in a <pre>. */
const container = document.getElementById('editor');
const output = document.getElementById('output');
if (!container || !output) throw new Error('page is missing #editor or #output');

const editor = createEditor(container, {
  plugins: [...defaultPlugins(), ...editorialKit()],
  initialHtml: '<p>Hypertext is great. Press Esc to leave.</p><p>Second paragraph with a few more words.</p>',
});
const show = (): void => {
  output.textContent = editor.getHtml();
};
editor.on('change', show);
show();
