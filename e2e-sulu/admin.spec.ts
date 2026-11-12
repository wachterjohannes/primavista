import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

/*
 * Primavista as the text_editor of a real Sulu admin: the project built by
 * e2e-sulu/setup.sh, Sulu's own webpack build, a real login, a real save.
 * The homepage of the skeleton has a text_editor field named `article`.
 */
const WEBSPACE = 'website';
const LOCALE = 'en';

const editor = (page: Page) => page.locator('.pv-editor [contenteditable="true"]');
const toolbar = (page: Page, title: string) => page.locator(`.pv-editor .pv-toolbar button[title^="${title}"]`);

async function homepageId(request: APIRequestContext): Promise<string> {
  const response = await request.get(`/admin/api/pages?webspace=${WEBSPACE}&locale=${LOCALE}&flat=true&limit=1`);
  const text = await response.text();
  if (!response.ok()) throw new Error(`pages API answered ${response.status()}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text) as { _embedded: { pages: Array<{ id: string }> } };
  const id = body._embedded.pages[0]?.id;
  if (!id) throw new Error('the skeleton has no homepage');
  return id;
}

async function storedArticle(request: APIRequestContext, id: string): Promise<string> {
  const response = await request.get(`/admin/api/pages/${id}?webspace=${WEBSPACE}&locale=${LOCALE}`);
  const page = (await response.json()) as { article?: string };
  return page.article ?? '';
}

async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Save/ }).first().click();
  await page.getByText('Save and publish').click();
  await expect(page.getByText(/saved|published/i).first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
}

async function selectBack(page: Page, count: number): Promise<void> {
  for (let i = 0; i < count; i++) await page.keyboard.press('Shift+ArrowLeft');
}

let errors: string[] = [];

test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' && message.text().startsWith('Primavista:')) errors.push(message.text());
  });
  await page.goto('/admin');
  await page.locator('input[type=text]').first().fill('admin');
  await page.locator('input[type=password]').fill('admin');
  const login = page.waitForResponse((r) => r.url().endsWith('/admin/login') && r.request().method() === 'POST');
  await page.keyboard.press('Enter');
  expect((await login).ok()).toBe(true);
  await expect(page.locator('input[type=password]')).toBeHidden();
});

test.afterEach(() => {
  expect(errors, 'no script errors and no Primavista warnings in the admin').toEqual([]);
});

async function openHomepage(page: Page): Promise<string> {
  const id = await homepageId(page.request);
  await page.goto(`/admin/#/webspaces/${WEBSPACE}/pages/${LOCALE}/${id}/content`);
  await editor(page).waitFor();
  await page.waitForTimeout(1000);
  await editor(page).click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  return id;
}

test('the admin starts with Primavista and the configured elements in the toolbar', async ({ page }) => {
  await openHomepage(page);
  await expect(page.locator('.pv-editor')).toHaveClass(/pv-theme-sulu/);
  await expect(toolbar(page, 'Bold')).toBeVisible();
  await expect(toolbar(page, 'Internal link')).toBeVisible();
  await expect(toolbar(page, 'Highlight')).toBeVisible();
  await expect(toolbar(page, 'Abbreviation')).toBeVisible();
});

test('a highlight is saved, sanitized by the server and loaded again', async ({ page }) => {
  const id = await openHomepage(page);
  await page.keyboard.type('Hello Sulu world');
  await selectBack(page, 'world'.length);
  await toolbar(page, 'Highlight').click();
  await save(page);

  expect(await storedArticle(page.request, id)).toContain('<mark class="yellow">world</mark>');

  await page.reload();
  await editor(page).waitFor();
  await expect(editor(page).locator('mark.yellow')).toHaveText('world');
});

test('an abbreviation asks for its title and the title survives the save', async ({ page }) => {
  const id = await openHomepage(page);
  await page.keyboard.type('HTML is markup');
  await selectBack(page, 'markup'.length);
  await toolbar(page, 'Abbreviation').click();
  const field = page.locator('.pv-link-form input');
  await expect(field).toBeFocused();
  await field.fill('Hypertext Markup Language');
  await page.keyboard.press('Enter');
  await save(page);

  expect(await storedArticle(page.request, id)).toContain('<abbr title="Hypertext Markup Language">markup</abbr>');
});

test('the server removes markup the project did not allow', async ({ page }) => {
  const id = await openHomepage(page);
  const response = await page.request.put(`/admin/api/pages/${id}?webspace=${WEBSPACE}&locale=${LOCALE}&action=publish`, {
    data: { template: 'homepage', title: 'Website', url: '/', article: '<p>ok <mark class="yellow">a</mark><script>alert(1)</script><mark class="unknown" onclick="x()">b</mark></p>' },
  });
  expect(response.ok()).toBe(true);
  const stored = await storedArticle(page.request, id);
  expect(stored).toContain('<mark class="yellow">a</mark>');
  expect(stored).not.toContain('<script');
  expect(stored).not.toContain('onclick');
});
