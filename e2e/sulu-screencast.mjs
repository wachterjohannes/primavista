/*
 * Records the Sulu screencast in docs/assets: Primavista as the text_editor
 * adapter in a running Sulu Admin. Needs a Sulu 3 project with the adapter
 * from docs/sulu-integration.md and one page whose template has a
 * `text_editor` field named `article`.
 *
 *   SULU_PAGE=<page uuid> node e2e/sulu-screencast.mjs
 *
 * Environment: SULU_URL (http://127.0.0.1:8899), SULU_USER and SULU_PASSWORD
 * (admin), SULU_WEBSPACE (website), SULU_LOCALE (en), SULU_PAGE_TITLE
 * (Website, the page picked in the link chooser), OUT
 * (e2e/output/sulu-screencast.webm). Convert with ffmpeg afterwards, see the
 * "Screencast" section of docs/sulu-integration.md.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const BASE = process.env.SULU_URL ?? 'http://127.0.0.1:8899';
const USER = process.env.SULU_USER ?? 'admin';
const PASSWORD = process.env.SULU_PASSWORD ?? 'admin';
const WEBSPACE = process.env.SULU_WEBSPACE ?? 'website';
const LOCALE = process.env.SULU_LOCALE ?? 'en';
const PAGE_ID = process.env.SULU_PAGE;
const PAGE_TITLE = process.env.SULU_PAGE_TITLE ?? 'Website';
const OUT = resolve(process.env.OUT ?? 'e2e/output/sulu-screencast.webm');
if (!PAGE_ID) throw new Error('Set SULU_PAGE to the uuid of a page with a text_editor field.');

const EDIT_URL = `${BASE}/admin/#/webspaces/${WEBSPACE}/pages/${LOCALE}/${PAGE_ID}/content`;
const SIZE = { width: 1440, height: 900 };
const TYPE = { delay: 35 };
const HIDE_DEBUG_TOOLBAR = '.sf-toolbar { display: none !important; }';
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch();

// Log in and empty the field without recording, so the video starts clean.
const setup = await browser.newContext({ viewport: SIZE });
{
  const page = await setup.newPage();
  await page.goto(`${BASE}/admin`);
  await page.locator('input[type=text]').first().fill(USER);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/admin\/#\//);
  await page.goto(EDIT_URL);
  const content = page.locator('.pv-editor [contenteditable="true"]');
  await content.waitFor();
  await page.waitForTimeout(1000);
  if ((await content.innerText()).trim() !== '') {
    await content.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Save/ }).first().click();
    await page.getByText('Save and publish').click();
    await page.waitForTimeout(2500);
  }
  await page.close();
}
const state = await setup.storageState();
await setup.close();

const context = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: dirname(OUT), size: SIZE },
  storageState: state,
});
const page = await context.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const toolbar = (title) => page.locator(`.pv-editor .pv-toolbar button[title^="${title}"]`);
const content = page.locator('.pv-editor [contenteditable="true"]');
const confirm = () => page.getByRole('button', { name: 'Confirm' });

await page.goto(EDIT_URL);
await page.addStyleTag({ content: HIDE_DEBUG_TOOLBAR });
await content.waitFor();
await pause(1500);

// Heading and a formatted paragraph.
await content.click();
await page.keyboard.type('Primavista inside Sulu', TYPE);
await page.locator('.pv-editor .pv-toolbar select').selectOption('h2');
await pause(600);
await page.keyboard.press('End');
await page.keyboard.press('Enter');
await page.keyboard.type('This paragraph is written with the new editor', TYPE);
await selectBack('new editor'.length);
await toolbar('Italic').click();
await pause(400);
await page.keyboard.press('End');
await toolbar('Italic').click();
await page.keyboard.type('. It replaces CKEditor', TYPE);
await selectBack('CKEditor'.length);
await toolbar('Bold').click();
await pause(400);
await page.keyboard.press('End');
await toolbar('Bold').click();
await page.keyboard.type('.', TYPE);
await page.keyboard.press('Enter');

// A list.
await toolbar('Bullet list').click();
await page.keyboard.type('MIT licensed', TYPE);
await page.keyboard.press('Enter');
await page.keyboard.type('Built on Lexical', TYPE);
await page.keyboard.press('Enter');
await page.keyboard.press('Enter');

// Internal link through Sulu's own overlay and page chooser.
await page.keyboard.type('Read more on the homepage', TYPE);
await selectBack('homepage'.length);
await toolbar('Internal link').click();
await pause(500);
await page.locator('.pv-editor [class*="menu"] button', { hasText: 'Pages' }).click();
await page.getByRole('button', { name: 'No page selected' }).waitFor();
await pause(800);
await page.locator('.su-document').last().click();
await page.getByRole('heading', { name: 'Choose page' }).waitFor();
await pause(800);
await page.getByRole('button', { name: PAGE_TITLE, exact: true }).first().click();
await pause(600);
await page.evaluate(() => {
  const chooser = [...document.querySelectorAll('body > div')].find((d) => d.textContent.includes('Choose page'));
  chooser.querySelector('.su-check').click();
});
await pause(500);
await confirm().last().click();
await page.getByRole('heading', { name: 'Choose page' }).waitFor({ state: 'detached' });
await pause(800);
await confirm().first().click();
await page.getByRole('button', { name: 'No page selected' }).waitFor({ state: 'detached' });
await pause(800);

// External link with Sulu's overlay.
await page.keyboard.press('End');
await page.keyboard.type(' and at sulu.io', TYPE);
await selectBack('sulu.io'.length);
await toolbar('External link').click();
await confirm().waitFor();
await pause(600);
const inputs = page.locator('input[type=text]');
const count = await inputs.count();
await inputs.nth(count - 2).click();
await page.keyboard.type('https://sulu.io', TYPE);
await inputs.nth(count - 1).click();
await page.keyboard.type('Sulu website', TYPE);
await pause(400);
await confirm().click();
await confirm().waitFor({ state: 'detached' });
await pause(600);
await page.keyboard.press('End');
await page.keyboard.type('.', TYPE);
await page.keyboard.press('Enter');
await pause(400);

// A table, filled with Tab, one row removed with the table tools.
await toolbar('Insert table').click();
await pause(600);
for (const cell of ['Editor', 'License', 'Size', 'Primavista', 'MIT', '133 KB']) {
  await page.keyboard.type(cell, TYPE);
  if (cell !== '133 KB') await page.keyboard.press('Tab');
}
await page.keyboard.press('ArrowDown');
await pause(400);
await toolbar('Delete row').click();
await pause(1200);

// Save and publish, then look at the website.
await page.getByRole('button', { name: /Save/ }).first().click();
await pause(600);
await page.getByText('Save and publish').click();
await pause(3000);
await page.goto(`${BASE}/`);
await page.addStyleTag({ content: HIDE_DEBUG_TOOLBAR });
await pause(3500);

const video = page.video();
await context.close();
await browser.close();
renameSync(await video.path(), OUT);
console.log(`wrote ${OUT}`);

async function selectBack(length) {
  for (let i = 0; i < length; i += 1) await page.keyboard.press('Shift+ArrowLeft');
  await pause(300);
}
