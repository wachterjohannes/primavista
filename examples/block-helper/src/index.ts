import { blockElement, voidElement } from '@primavista/core';

/** A note box around whole blocks, `<aside class="note">…</aside>`. */
export const note = blockElement({ name: 'note', tag: 'aside', className: 'note', toolbar: { label: 'Note' } });

/** A newsletter sign-up placeholder, `<div data-widget="newsletter"></div>`. */
export const newsletter = voidElement({
  name: 'newsletter',
  tag: 'div',
  attributes: ['data-widget'],
  defaults: { 'data-widget': 'newsletter' },
  render: (element) => {
    element.textContent = 'Newsletter sign-up';
  },
  toolbar: { label: 'Newsletter' },
});
