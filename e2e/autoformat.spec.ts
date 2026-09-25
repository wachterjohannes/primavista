import { expect, test } from '@playwright/test';
import { content, reactEditor, replaceContent, uxEditor } from './helpers';

test.describe('Autoformat and word count', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('turns typed Markdown into headings and lists', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    await replaceContent(editor, '## Title');
    await expect(content(editor).locator('h2')).toHaveText('Title');
    await expect(textarea).toHaveValue('<h2>Title</h2>');

    await page.keyboard.press('Enter');
    await page.keyboard.type('- one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('two **bold**');
    await expect(textarea).toHaveValue('<h2>Title</h2><ul><li>one</li><li>two <strong>bold</strong></li></ul>');
  });

  test('undoes a shortcut back to the typed text', async ({ page }) => {
    const editor = uxEditor(page);
    await replaceContent(editor, '## ');
    await expect(content(editor).locator('h2')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByTestId('ux-textarea')).toHaveValue('<p>## </p>');
  });

  test('counts words below the content and keeps the count out of the value', async ({ page }) => {
    const editor = uxEditor(page);
    const status = editor.locator('.pv-word-count');
    await replaceContent(editor, 'Three short words');
    await expect(status).toHaveText('Words: 3Characters: 17');
    await expect(page.getByTestId('ux-textarea')).toHaveValue('<p>Three short words</p>');
  });

  test('flags the soft limit in the React island', async ({ page }) => {
    const editor = reactEditor(page);
    const status = editor.locator('.pv-word-count');
    await replaceContent(editor, 'word '.repeat(101).trim());
    await expect(status).toHaveClass(/pv-word-count--over/);
    await expect(status.locator('[aria-live="polite"]')).toHaveText('Over the limit');
  });
});
