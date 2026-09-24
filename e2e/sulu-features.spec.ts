import { expect, test } from '@playwright/test';
import { content, reactEditor, replaceContent, selectAllIn, toolbarButton, uxEditor } from './helpers';

test.describe('Sulu feature parity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders stored internal links and edits them through the balloon', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    const internal = content(editor).locator('a.pv-internal-link');
    await expect(internal).toHaveText('About us');
    await expect(internal).toHaveAttribute('data-provider', 'page');

    await internal.click();
    const balloon = editor.locator('.pv-balloon');
    await expect(balloon).toBeVisible();
    await expect(balloon.locator('.pv-balloon-label')).toHaveText('Page: uuid-about');
    await balloon.locator('[data-pv-balloon-action="edit"]').click();
    const form = editor.locator('.pv-link-form');
    await expect(form.getByLabel('Resource id')).toHaveValue('uuid-about');
    await form.getByLabel('Anchor').fill('team');
    await form.locator('button[type="submit"]').click();
    await expect(textarea).toHaveValue(/<sulu-link href="uuid-about#team" provider="page" target="_self" title="About us">About us<\/sulu-link>/);

    await content(editor).locator('a.pv-internal-link').click();
    await balloon.locator('[data-pv-balloon-action="unlink"]').click();
    await expect(textarea).not.toHaveValue(/sulu-link/);
    await expect(textarea).toHaveValue(/<p>Internal link: About us<\/p>/);
  });

  test('creates an internal link from the provider menu', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    await replaceContent(editor, 'Brochure');
    await selectAllIn(editor);
    await toolbarButton(editor, 'internal-link').click();
    const menu = editor.locator('.pv-menu');
    await expect(menu.locator('.pv-menu-item')).toHaveText(['Page', 'Media']);
    await menu.locator('[data-pv-option="media"]').click();
    const form = editor.locator('.pv-link-form');
    await form.getByLabel('Resource id').fill('101');
    await form.getByLabel('Link title').fill('Download');
    await form.getByLabel('Link target').selectOption('_blank');
    await form.locator('button[type="submit"]').click();
    await expect(textarea).toHaveValue(
      '<p><sulu-link href="101" provider="media" target="_blank" title="Download">Brochure</sulu-link></p>',
    );
    await expect(toolbarButton(editor, 'internal-link')).toBeDisabled();
    await expect(toolbarButton(editor, 'link')).toBeDisabled();
  });

  test('external links carry target and title and show a preview', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    await replaceContent(editor, 'Sulu');
    await selectAllIn(editor);
    await toolbarButton(editor, 'link').click();
    const form = editor.locator('.pv-link-form');
    await form.getByLabel('Link URL').fill('https://sulu.io');
    await form.getByLabel('Link target').selectOption('_blank');
    await form.getByLabel('Link title').fill('Sulu CMS');
    await form.locator('button[type="submit"]').click();
    await expect(textarea).toHaveValue('<p><a href="https://sulu.io" target="_blank" title="Sulu CMS">Sulu</a></p>');

    await content(editor).locator('a').click();
    const balloon = editor.locator('.pv-balloon');
    await expect(balloon.locator('a.pv-balloon-preview')).toHaveAttribute('href', 'https://sulu.io');
    await balloon.locator('[data-pv-balloon-action="edit"]').click();
    await expect(editor.locator('.pv-link-form').getByLabel('Link URL')).toHaveValue('https://sulu.io');
    await editor.locator('.pv-link-form').getByLabel('Cancel').click();
    await expect(editor.locator('.pv-link-form')).toHaveCount(0);
  });

  test('aligns blocks and applies subscript, superscript and code', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    await replaceContent(editor, 'Centered');
    await toolbarButton(editor, 'align-center').click();
    await expect(textarea).toHaveValue('<p style="text-align: center;">Centered</p>');
    await expect(toolbarButton(editor, 'align-center')).toHaveAttribute('aria-pressed', 'true');
    await toolbarButton(editor, 'align-center').click();
    await expect(textarea).toHaveValue('<p>Centered</p>');

    await selectAllIn(editor);
    await toolbarButton(editor, 'superscript').click();
    await expect(textarea).toHaveValue('<p><sup>Centered</sup></p>');
    await toolbarButton(editor, 'superscript').click();
    await toolbarButton(editor, 'subscript').click();
    await expect(textarea).toHaveValue('<p><sub>Centered</sub></p>');
    await toolbarButton(editor, 'subscript').click();
    await toolbarButton(editor, 'code').click();
    await expect(textarea).toHaveValue('<p><code>Centered</code></p>');
  });

  test('merges and splits table cells with a drag selection', async ({ page }) => {
    const editor = uxEditor(page);
    const textarea = page.getByTestId('ux-textarea');
    await replaceContent(editor, 'Tbl');
    await toolbarButton(editor, 'insert-table').click();
    const cells = content(editor).locator('tr').nth(1).locator('td');
    await expect(cells).toHaveCount(3);
    await expect(toolbarButton(editor, 'table-merge-cells')).toBeDisabled();

    const first = await cells.nth(0).boundingBox();
    const second = await cells.nth(1).boundingBox();
    if (!first || !second) throw new Error('cells not laid out');
    await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2, { steps: 6 });
    await page.mouse.up();

    await expect(toolbarButton(editor, 'table-merge-cells')).toBeEnabled();
    await toolbarButton(editor, 'table-merge-cells').click();
    await expect(textarea).toHaveValue(/<tr><td colspan="2"><\/td><td><\/td><\/tr>/);
    await expect(toolbarButton(editor, 'table-split-cell')).toBeEnabled();
    await toolbarButton(editor, 'table-split-cell').click();
    await expect(textarea).not.toHaveValue(/colspan/);
  });

  test('react binding uses the host dialog for internal links', async ({ page }) => {
    const editor = reactEditor(page);
    await replaceContent(editor, 'Team');
    await selectAllIn(editor);
    await toolbarButton(editor, 'internal-link').click();
    await editor.locator('.pv-menu [data-pv-option="page"]').click();
    const dialog = page.getByTestId('react-link-dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('react-link-resource').selectOption('uuid-contact');
    await page.getByTestId('react-link-anchor').fill('map');
    await page.getByTestId('react-link-confirm').click();
    await expect(page.getByTestId('react-output')).toHaveText(
      '<p><sulu-link href="uuid-contact#map" provider="page" target="_self" title="Contact">Team</sulu-link></p>',
    );
    await content(editor).locator('a.pv-internal-link').click();
    await expect(editor.locator('.pv-balloon .pv-balloon-label')).toHaveText('page: Contact');
  });
});
