'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const core = loadCore();
// vm 문맥에서 만든 객체는 프로토타입이 달라 deepEqual 전에 평범한 값으로 바꾼다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const tally = (text) => plain(core.tally(text));
const row = (name, valid, average, blank, excluded) => ({ name, valid, average, blank, excluded });
const pick = (r) => r.questions.map((q) => row(q.name, q.valid, q.average, q.blank, q.excluded));

test('classifyCell: 앞뒤 공백을 지운 1~5만 유효', () => {
  for (const v of ['1', '2', '3', '4', '5', ' 3', '4 ', '\t5\t', ' 2　']) {
    assert.equal(core.classifyCell(v), 'valid', JSON.stringify(v));
  }
});

test('classifyCell: 없음·빈칸·공백만은 빈 응답', () => {
  for (const v of [undefined, null, '', ' ', '   ', '　', ' ']) {
    assert.equal(core.classifyCell(v), 'blank', JSON.stringify(v));
  }
});

test('classifyCell: 그 밖의 값은 제외', () => {
  for (const v of ['0', '6', '10', '3.0', '3.5', '-1', '+3', '１', 'a', '3점', '1 2', '05', '"3"']) {
    assert.equal(core.classifyCell(v), 'excluded', JSON.stringify(v));
  }
});

test('formatAverage: 유효 0이면 "-"', () => {
  assert.equal(core.formatAverage(0, 0), '-');
});

test('formatAverage: 둘째 자리까지 0을 채움', () => {
  assert.equal(core.formatAverage(3, 1), '3.00');
  assert.equal(core.formatAverage(7, 2), '3.50');
  assert.equal(core.formatAverage(10, 3), '3.33');
  assert.equal(core.formatAverage(11, 3), '3.67');
  assert.equal(core.formatAverage(5, 1), '5.00');
});

test('formatAverage: 셋째 자리에서 반올림(0.5는 올림)', () => {
  assert.equal(core.formatAverage(469, 200), '2.35'); // 2.345 → 2.35
  assert.equal(core.formatAverage(201, 200), '1.01'); // 1.005 → 1.01 (부동소수로 하면 1.00이 되기 쉬움)
  assert.equal(core.formatAverage(1001, 1000), '1.00'); // 1.001 → 1.00
  assert.equal(core.formatAverage(2009, 1000), '2.01'); // 2.009 → 2.01
  assert.equal(core.formatAverage(2, 3), '0.67');
});

test('parseTsv: 탭·줄바꿈(\\r\\n, \\n, \\r) 구분, 끝 빈 줄 버림', () => {
  assert.deepEqual(plain(core.parseTsv('a\tb\r\n1\t2\r\n')), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(plain(core.parseTsv('a\tb\n1\t2')), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(plain(core.parseTsv('a\tb\r1\t2\r\r')), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(plain(core.parseTsv('')), []);
  assert.deepEqual(plain(core.parseTsv('\n\n')), []);
});

test('parseTsv: 빈 칸과 탭만 있는 줄은 유지', () => {
  assert.deepEqual(plain(core.parseTsv('a\tb\tc\n1\t\t\n\t\t\n')), [['a', 'b', 'c'], ['1', '', ''], ['', '', '']]);
});

test('parseTsv: 엑셀 따옴표 칸(줄바꿈·탭·따옴표 포함)을 한 칸으로 읽음', () => {
  assert.deepEqual(
    plain(core.parseTsv('번호\t"만족도\n(전체)"\t"그는 ""좋다""\t함"\n1\t3\t4')),
    [['번호', '만족도\n(전체)', '그는 "좋다"\t함'], ['1', '3', '4']]
  );
});

test('parseTsv: 제대로 닫히지 않은 따옴표는 글자 그대로', () => {
  assert.deepEqual(plain(core.parseTsv('a\t"b\n1\t"3"x')), [['a', '"b'], ['1', '"3"x']]);
});

test('tally: 기본 집계와 첫 열 제외', () => {
  const text = [
    '응답번호\tQ1\tQ2\tQ3',
    '1\t5\t3\t',
    '2\t4\t \t2',
    '3\t3\tx\t6',
    '4\t1\t0\t',
  ].join('\r\n') + '\r\n';
  const r = tally(text);
  assert.equal(r.error, null);
  assert.equal(r.responseCount, 4);
  assert.deepEqual(pick(r), [
    row('Q1', 4, '3.25', 0, 0),
    row('Q2', 1, '3.00', 1, 2),
    row('Q3', 1, '2.00', 2, 1),
  ]);
});

test('tally: 응답번호 열 값은 무엇이든 집계에 영향 없음', () => {
  const r = tally('id\tQ1\nabc\t2\n\t4\n5\t');
  assert.deepEqual(pick(r), [row('Q1', 2, '3.00', 1, 0)]);
});

test('tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로', () => {
  const r = tally('번호\tA\tB\tC\n1\t5\n2\n3\t1\t2\t3');
  assert.deepEqual(pick(r), [
    row('A', 2, '3.00', 1, 0),
    row('B', 1, '2.00', 2, 0),
    row('C', 1, '3.00', 2, 0),
  ]);
});

test('tally: 머리글보다 많은 칸은 무시', () => {
  const r = tally('번호\tA\n1\t2\t9\tx');
  assert.deepEqual(pick(r), [row('A', 1, '2.00', 0, 0)]);
});

test('tally: 유효 응답이 없으면 평균 "-"', () => {
  const r = tally('번호\tA\tB\n1\t\tz\n2\t \t7');
  assert.deepEqual(pick(r), [row('A', 0, '-', 2, 0), row('B', 0, '-', 0, 2)]);
});

test('tally: 머리글만 있으면 모두 0', () => {
  const r = tally('번호\tA\tB\r\n');
  assert.equal(r.error, null);
  assert.equal(r.responseCount, 0);
  assert.deepEqual(pick(r), [row('A', 0, '-', 0, 0), row('B', 0, '-', 0, 0)]);
});

test('tally: 머리글 이름은 앞뒤 공백 제거, 비면 열 번호로', () => {
  const r = tally('번호\t  만족도 \t\t"여러\n줄"\n1\t1\t2\t3');
  assert.deepEqual(r.questions.map((q) => q.name), ['만족도', '(3열)', '여러\n줄']);
});

test('tally: 빈 입력과 문항 없는 머리글은 오류', () => {
  assert.equal(tally('').error, 'empty');
  assert.equal(tally('   \n').error, 'no-questions');
  assert.equal(tally('번호\n1\n2').error, 'no-questions');
});

test('tally: 평균 반올림을 집계 경로에서도 확인', () => {
  // 1이 199개, 2가 1개 → 201/200 = 1.005 → 1.01
  const lines = ['n\tQ'];
  for (let i = 0; i < 199; i += 1) lines.push(i + '\t1');
  lines.push('199\t2');
  const r = tally(lines.join('\n'));
  assert.deepEqual(pick(r), [row('Q', 200, '1.01', 0, 0)]);
});
