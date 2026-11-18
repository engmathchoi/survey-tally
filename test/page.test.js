'use strict';
// 페이지 정적 검사: 외부 자원·저장·전송 API를 쓰지 않는지, 화면과 계산이 떨어져 있는지.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readHtml } = require('./load-core');

const html = readHtml();
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];

test('외부 자원(src/href/url())을 불러오지 않음', () => {
  assert.doesNotMatch(html, /\b(?:src|href|action)\s*=\s*["']?\s*(?:https?:)?\/\//i);
  assert.doesNotMatch(html, /url\(\s*["']?\s*(?:https?:)?\/\//i);
  assert.doesNotMatch(html, /@import/i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /<link\b/i);
});

test('저장·전송 API를 쓰지 않음', () => {
  const code = scripts.map((m) => m[1]).join('\n');
  for (const word of ['fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches', 'serviceWorker',
    'postMessage', 'BroadcastChannel', 'window.open', 'Image(']) {
    assert.ok(!code.includes(word), word + ' 사용 금지');
  }
  assert.doesNotMatch(html, /<form\b/i);
});

test('CSP로 외부 연결을 막음', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m, 'CSP 메타 태그가 있어야 함');
  const csp = m[1];
  for (const d of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "img-src 'none'"]) {
    assert.ok(csp.includes(d), d);
  }
});

test('계산 블록은 DOM을 건드리지 않음', () => {
  const core = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  assert.ok(core);
  assert.doesNotMatch(core[1], /\b(?:document|window)\b/);
});

test('결과 표 머리글이 정해진 순서', () => {
  const head = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  const names = [...head.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(names, ['문항', '유효 응답', '평균', '빈 응답', '제외']);
});

test('저장소 맨 위에 빈 .nojekyll', () => {
  const p = path.join(__dirname, '..', '.nojekyll');
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});
