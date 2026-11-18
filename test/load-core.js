'use strict';
// index.html에서 <script id="tally-core"> 블록만 꺼내 격리된 vm 문맥에서 실행한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

function readHtml() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function loadCore() {
  const html = readHtml();
  const m = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 <script id="tally-core"> 블록이 없습니다');
  const sandbox = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(m[1], sandbox, { filename: 'index.html#tally-core' });
  return sandbox.SurveyTally;
}

module.exports = { loadCore, readHtml };
