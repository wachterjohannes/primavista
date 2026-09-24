import { expect, test } from '@playwright/test';
import { content, expectToolbar, INITIAL_HTML, reactEditor, replaceContent, selectAllIn, toolbarButton } from './helpers';

test.describe('React binding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the controlled editor with the initial value', async ({ page }) => {
    const editor = reactEditor(page);
    await expectToolbar(editor);
    await expect(content(editor)).toHaveAttribute('aria-label', 'React editor');
    await expect(editor).toHaveClass(/pv-theme-sulu/);
    await expect(page.getByTestId('react-output')).toHaveText(INITIAL_HTML);
  });

  test('writes CKEditor-compatible table markup with the sulu preset', async ({ page }) => {
    const editor = reactEditor(page);
    await replaceContent(editor, 'Tbl');
    await toolbarButton(editor, 'insert-table').click();
    await expect(page.getByTestId('react-output')).toHaveText(
      /<figure class="table"><table><thead><tr><th><\/th><th><\/th><th><\/th><\/tr><\/thead><tbody><tr>/,
    );
  });

  test('reports onChange and onBlur like a Sulu field', async ({ page }) => {
    const editor = reactEditor(page);
    await replaceContent(editor, 'Typed in React');
    await expect(page.getByTestId('react-output')).toHaveText('<p>Typed in React</p>');
    await selectAllIn(editor);
    await toolbarButton(editor, 'italic').click();
    await expect(page.getByTestId('react-output')).toHaveText('<p><em>Typed in React</em></p>');

    await expect(page.getByTestId('react-blur-count')).toHaveText('blur: 0');
    await page.getByRole('heading', { name: 'Primavista', level: 1 }).click();
    await expect(page.getByTestId('react-blur-count')).toHaveText('blur: 1');
  });

  test('follows value changes from outside', async ({ page }) => {
    const editor = reactEditor(page);
    await page.getByTestId('react-set-value').click();
    await expect(content(editor).locator('h2')).toHaveText('Set from outside');
    await expect(page.getByTestId('react-output')).toHaveText('<h2>Set from outside</h2><p>Controlled value.</p>');
    await page.getByTestId('react-clear').click();
    await expect(page.getByTestId('react-output')).toHaveText('');
    await expect(editor.locator('.pv-placeholder')).toBeVisible();
    await content(editor).click();
    await page.keyboard.type('Again');
    await expect(page.getByTestId('react-output')).toHaveText('<p>Again</p>');
  });

  test('both editors work independently on one page', async ({ page }) => {
    const react = reactEditor(page);
    const ux = page.getByTestId('ux-section').locator('.pv-editor');
    await replaceContent(react, 'React side');
    await replaceContent(ux, 'Stimulus side');
    await expect(page.getByTestId('react-output')).toHaveText('<p>React side</p>');
    await expect(page.getByTestId('ux-textarea')).toHaveValue('<p>Stimulus side</p>');
  });
});
