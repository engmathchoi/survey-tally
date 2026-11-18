'use strict';
// 실제 브라우저로 붙여넣기 → 표 표시를 확인한다. Playwright가 없으면 건너뛴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let playwright = null;
try { playwright = require('playwright'); } catch (_) { /* 선택 사항 */ }

test('브라우저에서 붙여넣으면 결과 표가 나오고 외부 요청이 없음', { skip: !playwright && 'playwright 없음' }, async () => {
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on('request', (req) => requests.push(req.url()));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const url = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
    await page.goto(url);

    const data = '응답번호\t만족도\t추천\t<b>의견</b>\r\n1\t5\t4\t\r\n2\t 3 \tx\r\n3\t4\r\n';
    // 붙여넣기와 같은 input 이벤트로 값을 채운다.
    await page.fill('#input', data);

    const rows = await page.$$eval('#result tbody tr', (trs) =>
      trs.map((tr) => [...tr.children].map((c) => c.textContent)));
    assert.deepEqual(rows, [
      ['만족도', '3', '4.00', '0', '0'],
      ['추천', '1', '4.00', '1', '1'],
      ['<b>의견</b>', '0', '-', '3', '0'],
    ]);
    assert.equal(await page.$eval('#result', (t) => t.hidden), false);
    assert.match(await page.textContent('#status'), /응답 3줄, 문항 3개/);

    await page.click('#clear');
    assert.equal(await page.$eval('#result', (t) => t.hidden), true);
    assert.equal(await page.inputValue('#input'), '');

    assert.deepEqual(errors, []);
    assert.deepEqual(requests.filter((u) => u !== url), []);
  } finally {
    await browser.close();
  }
});
