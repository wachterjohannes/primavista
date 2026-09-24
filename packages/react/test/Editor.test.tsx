import { act, cleanup, render } from '@testing-library/react';
import { $getRoot } from 'lexical';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);
import { Editor, type EditorHandle, formatting, type PrimavistaEditor } from '../src';

function typeInto(editor: PrimavistaEditor, text: string): void {
  act(() => {
    editor.lexical.update(
      () => {
        $getRoot().selectEnd().insertText(text);
      },
      { discrete: true },
    );
  });
}

describe('<Editor>', () => {
  it('mounts the core editor and reports changes', () => {
    const onChange = vi.fn();
    const onReady = vi.fn();
    const { container } = render(<Editor defaultValue="<p>Hi</p>" onChange={onChange} onReady={onReady} />);
    expect(container.querySelector('.pv-editor')).not.toBeNull();
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull();
    const editor = onReady.mock.calls[0]![0] as PrimavistaEditor;
    expect(editor.getHtml()).toBe('<p>Hi</p>');
    typeInto(editor, '!');
    expect(onChange).toHaveBeenCalledWith('<p>Hi!</p>');
  });

  it('applies controlled value updates without echoing them back', () => {
    const onChange = vi.fn();
    const onReady = vi.fn();
    function Harness() {
      const [value, setValue] = useState('<p>One</p>');
      return (
        <>
          <button type="button" onClick={() => setValue('<p>Two</p>')}>
            set
          </button>
          <Editor value={value} onChange={(html) => { onChange(html); setValue(html); }} onReady={onReady} />
        </>
      );
    }
    const { getByText } = render(<Harness />);
    const editor = onReady.mock.calls[0]![0] as PrimavistaEditor;
    act(() => getByText('set').click());
    expect(editor.getHtml()).toBe('<p>Two</p>');
    expect(onChange).not.toHaveBeenCalled();
    typeInto(editor, '!');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(editor.getHtml()).toBe('<p>Two!</p>');
  });

  it('exposes a handle and follows the disabled prop', () => {
    const ref = createRef<EditorHandle>();
    const { rerender } = render(<Editor ref={ref} defaultValue="<p>x</p>" />);
    expect(ref.current?.getHtml()).toBe('<p>x</p>');
    act(() => ref.current?.setHtml('<p>y</p>'));
    expect(ref.current?.getHtml()).toBe('<p>y</p>');
    expect(ref.current?.editor?.isEditable()).toBe(true);
    rerender(<Editor ref={ref} defaultValue="<p>x</p>" disabled />);
    expect(ref.current?.editor?.isEditable()).toBe(false);
  });

  it('accepts a custom plugin list and cleans up on unmount', () => {
    const { container, unmount } = render(<Editor plugins={[formatting({ formats: ['bold', 'italic'] })]} />);
    const ids = Array.from(container.querySelectorAll('[data-pv-item]')).map((el) => el.getAttribute('data-pv-item'));
    expect(ids).toEqual(['bold', 'italic']);
    unmount();
    expect(container.querySelector('.pv-editor')).toBeNull();
  });

  it('forwards blur and focus', () => {
    const onBlur = vi.fn();
    const onFocus = vi.fn();
    const onReady = vi.fn();
    render(<Editor onBlur={onBlur} onFocus={onFocus} onReady={onReady} />);
    const editor = onReady.mock.calls[0]![0] as PrimavistaEditor;
    act(() => {
      editor.contentElement.dispatchEvent(new FocusEvent('focus'));
      editor.contentElement.dispatchEvent(new FocusEvent('blur'));
    });
    expect(onFocus).toHaveBeenCalledOnce();
    expect(onBlur).toHaveBeenCalledOnce();
  });
});
