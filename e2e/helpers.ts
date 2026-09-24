import { expect, type Locator, type Page } from '@playwright/test';

export const INITIAL_HTML =
  '<h2>Primavista</h2><p>Same core, <strong>two bindings</strong>. Edit me.</p><ul><li>Symfony UX above</li><li>React below</li></ul><p>Internal link: <sulu-link href="uuid-about" provider="page" target="_self" title="About us">About us</sulu-link></p>';

export function uxEditor(page: Page): Locator {
  return page.getByTestId('ux-section').locator('.pv-editor');
}

export function reactEditor(page: Page): Locator {
  return page.getByTestId('react-section').locator('.pv-editor');
}

export function content(editor: Locator): Locator {
  return editor.locator('.pv-content');
}

export function toolbarButton(editor: Locator, id: string): Locator {
  return editor.locator(`[data-pv-item="${id}"]`);
}

export async function selectAllIn(editor: Locator): Promise<void> {
  await content(editor).click();
  await editor.page().keyboard.press('ControlOrMeta+a');
}

export async function replaceContent(editor: Locator, text: string): Promise<void> {
  await selectAllIn(editor);
  await editor.page().keyboard.press('Backspace');
  await editor.page().keyboard.type(text);
}

export async function expectToolbar(editor: Locator): Promise<void> {
  await expect(editor.getByRole('toolbar')).toBeVisible();
  await expect(toolbarButton(editor, 'bold')).toBeVisible();
  await expect(toolbarButton(editor, 'insert-table')).toBeVisible();
}
