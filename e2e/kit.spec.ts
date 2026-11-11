import { expect, test, type Page } from '@playwright/test';

/*
 * The editorial kit in a real browser. jsdom has no real selection, clipboard
 * or focus handling, which is where a Lexical update breaks helpers first.
 */
const KIT = 'http://127.0.0.1:8798/';

const editor = (page: Page) => page.locator('.pv-editor');
const content = (page: Page) => page.locator('.pv-content');
const output = (page: Page) => page.getByTestId('output');
const item = (page: Page, id: string) => page.locator(`[data-pv-item="${id}"]`);

/** Selects "Hypertext", the first word of the first paragraph, one character at a time so every OS selects the same. */
async function selectFirstWord(page: Page): Promise<void> {
  await content(page).locator('p').first().click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('Home');
  for (let i = 0; i < 'Hypertext'.length; i++) await page.keyboard.press('Shift+ArrowRight');
}

test.beforeEach(async ({ page }) => {
  await page.goto(KIT);
  await expect(editor(page)).toBeVisible();
});

test('wraps the selection in the yellow highlight and unwraps it again', async ({ page }) => {
  await selectFirstWord(page);
  await item(page, 'highlight-yellow').click();
  await expect(output(page)).toContainText('<mark class="yellow">Hypertext</mark> is great');
  await item(page, 'highlight-yellow').click();
  await expect(output(page)).not.toContainText('<mark');
});

test('asks for the title of an abbreviation', async ({ page }) => {
  await selectFirstWord(page);
  await item(page, 'abbreviation').click();
  const field = page.locator('.pv-link-form input');
  await expect(field).toBeFocused();
  await field.fill('Hypertext Markup Language');
  await page.keyboard.press('Enter');
  await expect(output(page)).toContainText('<abbr title="Hypertext Markup Language">Hypertext</abbr>');
  await expect(page.locator('.pv-link-form')).toHaveCount(0);
});

test('shows the title of an abbreviation in a balloon on hover', async ({ page }) => {
  await selectFirstWord(page);
  await item(page, 'abbreviation').click();
  await page.locator('.pv-link-form input').fill('Hypertext Markup Language');
  await page.keyboard.press('Enter');
  await content(page).locator('abbr').hover();
  await expect(page.locator('.pv-balloon')).toContainText('Hypertext Markup Language');
});

test('inserts a snippet and a special character from the menus', async ({ page }) => {
  await content(page).locator('p').last().click();
  await page.keyboard.press('End');
  await item(page, 'special-characters').click();
  await page.locator('.pv-menu-item', { hasText: '§' }).click();
  await expect(output(page)).toContainText('words.§');
  await item(page, 'snippets').click();
  await page.locator('.pv-menu-item', { hasText: 'Disclaimer' }).click();
  await expect(output(page)).toContainText('<em>Prices include VAT.</em>');
});

test('changes the case of the selection', async ({ page }) => {
  await selectFirstWord(page);
  await item(page, 'text-case').click();
  await page.locator('.pv-menu-item', { hasText: 'UPPERCASE' }).click();
  await expect(output(page)).toContainText('<p>HYPERTEXT is great.');
});

test('follows the real selection in the status line and the pressed state', async ({ page }) => {
  const status = page.locator('.selection-status');
  await selectFirstWord(page);
  await expect(status).toContainText('1 words selected, in p');
  await expect(item(page, 'important')).not.toHaveAttribute('aria-pressed', 'true');
  await item(page, 'important').click();
  await expect(output(page)).toContainText('<strong>Hypertext</strong>');
  await expect(item(page, 'important')).toHaveAttribute('aria-pressed', 'true');
});

test('keeps the kit markup when pasted from the clipboard and drops what it does not know', async ({ page }) => {
  // A real copy and paste. Firefox ignores the clipboardData of a synthetic ClipboardEvent.
  await page.evaluate(() => {
    const source = document.getElementById('paste-source');
    if (source) window.getSelection()?.selectAllChildren(source);
  });
  await page.keyboard.press('ControlOrMeta+c');
  await content(page).locator('p').last().click();
  await page.keyboard.press('End');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(output(page)).toContainText('<mark class="green">pasted</mark>');
  await expect(output(page)).toContainText('<kbd>Ctrl</kbd>');
  await expect(output(page)).not.toContainText('onclick');
  await expect(output(page)).not.toContainText('<mark>plain');
});
