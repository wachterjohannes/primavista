import { expect, test } from '@playwright/test';
import { content, expectToolbar, replaceContent, selectAllIn, toolbarButton, UX_INITIAL_HTML, uxEditor } from './helpers';

test.describe('Symfony UX binding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('mounts on the form textarea and hides it', async ({ page }) => {
    const editor = uxEditor(page);
    await expectToolbar(editor);
    const textarea = page.getByTestId('ux-textarea');
    await expect(textarea).toHaveAttribute('data-controller', 'primavista--ux-bundle--editor');
    await expect(textarea).toHaveAttribute('aria-hidden', 'true');
    await expect(textarea).toHaveValue(UX_INITIAL_HTML);
    await expect(content(editor).locator('h2')).toHaveText('Primavista');
    await expect(content(editor).locator('strong')).toHaveText('two bindings');
    await expect(content(editor).locator('li')).toHaveCount(2);
    await expect(page.getByTestId('ux-live')).toHaveText(UX_INITIAL_HTML);
  });

  test('keeps the textarea in sync while typing', async ({ page }) => {
    const editor = uxEditor(page);
    await replaceContent(editor, 'Hello from Stimulus');
    await expect(page.getByTestId('ux-textarea')).toHaveValue('<p>Hello from Stimulus</p>');
    await expect(page.getByTestId('ux-live')).toHaveText('<p>Hello from Stimulus</p>');
  });

  test('formats text and submits clean HTML through the form', async ({ page }) => {
    const editor = uxEditor(page);
    await replaceContent(editor, 'Bold words');
    await selectAllIn(editor);
    await toolbarButton(editor, 'bold').click();
    await expect(toolbarButton(editor, 'bold')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('ux-textarea')).toHaveValue('<p><strong>Bold words</strong></p>');

    await page.getByTestId('ux-submit').click();
    await expect(page.getByTestId('ux-submitted')).toHaveText('<p><strong>Bold words</strong></p>');
    await expect(page.getByTestId('ux-rendered').locator('strong')).toHaveText('Bold words');
    // The editor re-renders the submitted value after the round trip.
    await expect(content(uxEditor(page)).locator('strong')).toHaveText('Bold words');
  });

  test('switches headings, lists and links from the toolbar', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');

    await replaceContent(editor, 'Chapter');
    await editor.locator('select[data-pv-item="block-type"]').selectOption('h2');
    await expect(textarea).toHaveValue('<h2>Chapter</h2>');

    await editor.locator('select[data-pv-item="block-type"]').selectOption('paragraph');
    await toolbarButton(editor, 'bullet-list').click();
    await expect(textarea).toHaveValue('<ul><li>Chapter</li></ul>');
    await toolbarButton(editor, 'bullet-list').click();
    await expect(textarea).toHaveValue('<p>Chapter</p>');

    await selectAllIn(editor);
    await toolbarButton(editor, 'link').click();
    const urlInput = editor.getByLabel('Link URL');
    await expect(urlInput).toBeFocused();
    await urlInput.fill('https://sulu.io');
    await urlInput.press('Enter');
    await expect(textarea).toHaveValue('<p><a href="https://sulu.io">Chapter</a></p>');
  });

  test('inserts and edits a table', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    await replaceContent(editor, 'Intro');
    await expect(toolbarButton(editor, 'table-row-after')).toBeHidden();

    await toolbarButton(editor, 'insert-table').click();
    await expect(content(editor).locator('table')).toBeVisible();
    await expect(content(editor).locator('th')).toHaveCount(3);
    await expect(toolbarButton(editor, 'table-row-after')).toBeVisible();

    await page.keyboard.type('Cell');
    await expect(textarea).toHaveValue(/<table><tbody><tr><th>Cell<\/th><th><\/th><th><\/th><\/tr>/);

    await toolbarButton(editor, 'table-row-after').click();
    await expect(content(editor).locator('tr')).toHaveCount(4);
    await toolbarButton(editor, 'table-column-after').click();
    await expect(content(editor).locator('th')).toHaveCount(4);
    await toolbarButton(editor, 'table-delete').click();
    await expect(content(editor).locator('table')).toHaveCount(0);
    await expect(toolbarButton(editor, 'table-row-after')).toBeHidden();
  });

  test('undo and redo work from the toolbar', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    await expect(toolbarButton(editor, 'undo')).toBeDisabled();
    await replaceContent(editor, 'First');
    await expect(toolbarButton(editor, 'undo')).toBeEnabled();
    await toolbarButton(editor, 'undo').click();
    await expect(textarea).not.toHaveValue('<p>First</p>');
    await toolbarButton(editor, 'redo').click();
    await expect(textarea).toHaveValue('<p>First</p>');
  });

  test('accepts app plugins through the pre-connect event', async ({ page }) => {
    const editor = uxEditor(page);
    const highlight = toolbarButton(editor, 'highlight');
    await expect(highlight).toBeVisible();
    await replaceContent(editor, 'Marked');
    await selectAllIn(editor);
    await highlight.click();
    await expect(highlight).toHaveAttribute('aria-pressed', 'true');
    await expect(content(editor).locator('mark, .pv-highlight')).toHaveCount(1);
  });

  test('has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await expectToolbar(uxEditor(page));
    await replaceContent(uxEditor(page), 'Quiet');
    expect(errors).toEqual([]);
  });
});
