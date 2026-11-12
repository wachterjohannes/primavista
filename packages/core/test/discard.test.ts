import { describe, expect, it, vi } from 'vitest';
import { blockElement, defaultPlugins, inlineElement, voidElement, type PrimavistaPlugin } from '../src';
import { mount } from '../src/testing';

const kit: PrimavistaPlugin[] = [
  inlineElement({ name: 'yellow', tag: 'mark', className: 'yellow', toolbar: false }),
  inlineElement({ name: 'abbr', tag: 'abbr', attributes: ['title'], toolbar: false }),
  blockElement({ name: 'note', tag: 'aside', className: 'note', toolbar: false }),
  voidElement({ name: 'widget', tag: 'div', defaults: { 'data-widget': 'newsletter' }, toolbar: false }),
];

const html = '<p>a <mark class="yellow">b</mark> <abbr title="x">c</abbr></p><aside class="note"><p>n</p></aside><div data-widget="newsletter"></div>';

describe('markup the editor cannot write back', () => {
  it('is reported when the plugin that owns it is not loaded', () => {
    const onDiscard = vi.fn();
    const { editor } = mount({ plugins: defaultPlugins(), initialHtml: html, onDiscard });
    expect(editor.getDiscarded().map((d) => `${d.tag}${d.className ? `.${d.className}` : ''}`).sort()).toEqual(['abbr', 'aside.note', 'mark.yellow']);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('is empty when every plugin is loaded', () => {
    const onDiscard = vi.fn();
    const { editor } = mount({ plugins: [...defaultPlugins(), ...kit], initialHtml: html, onDiscard });
    expect(editor.getDiscarded()).toEqual([]);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('ignores normal clean-up such as b, i, bare wrappers and empty paragraphs', () => {
    const { editor } = mount({ plugins: defaultPlugins(), initialHtml: '<div><p><b>a</b> <i>b</i> <span>c</span></p><p></p><br></div>' });
    expect(editor.getDiscarded()).toEqual([]);
  });

  it('is recomputed on setHtml', () => {
    const { editor } = mount({ plugins: defaultPlugins() });
    editor.setHtml('<p><mark class="yellow">x</mark></p>');
    expect(editor.getDiscarded()).toEqual([{ tag: 'mark', className: 'yellow', count: 1 }]);
    editor.setHtml('<p>x</p>');
    expect(editor.getDiscarded()).toEqual([]);
  });

  it('reports the same list once, also when the same value is set again', () => {
    const onDiscard = vi.fn();
    const { editor } = mount({ plugins: defaultPlugins(), initialHtml: html, onDiscard });
    editor.setHtml(html);
    editor.setHtml(html);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('does not fire a change when it loads', () => {
    const { editor } = mount({ plugins: defaultPlugins(), initialHtml: html });
    const onChange = vi.fn();
    editor.on('change', onChange);
    editor.setHtml(html);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('a plugin that throws while registering', () => {
  const broken: PrimavistaPlugin = {
    name: 'broken',
    register() {
      throw new Error('boom');
    },
  };

  it('is skipped and reported, the editor keeps working', () => {
    const onPluginError = vi.fn();
    const { editor } = mount({ plugins: [...defaultPlugins(), broken, ...kit], initialHtml: html, onPluginError });
    expect(onPluginError).toHaveBeenCalledWith('broken', expect.objectContaining({ message: 'boom' }));
    expect(editor.failedPlugins).toEqual(['broken']);
    expect(editor.getHtml()).toBe(html);
  });

  it('goes to console.error without a handler', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { editor } = mount({ plugins: [...defaultPlugins(), broken] });
    expect(spy).toHaveBeenCalled();
    expect(editor.failedPlugins).toEqual(['broken']);
    spy.mockRestore();
  });
});
