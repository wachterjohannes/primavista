import { defaultPlugins } from '@primavista/core';
import { button, mount, typeText } from '@primavista/core/testing';
import { expect, it } from 'vitest';
import { sectionSign } from '../src';

it('inserts a section sign at the cursor', () => {
  const { editor, container } = mount({ plugins: [...defaultPlugins(), sectionSign] });
  typeText(editor, 'Art. 5 ');
  button(editor, 'section-sign').click();
  expect(editor.getHtml()).toContain('Art. 5 §');
  editor.destroy();
  container.remove();
});
