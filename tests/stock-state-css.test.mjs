import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');

test('zero-stock markers never inherit the generic .empty placeholder style', () => {
  // .empty is an intentionally spacious placeholder. It must NEVER be on
  // a compact stock/list/legend marker, or it adds dashed borders and padding.
  assert.match(html, /\.empty\{border:1px dashed/);
  for (const selector of ['stock-mark', 'list-marker', 'legend-swatch']) {
    assert.match(html, new RegExp('\\.' + selector + '\\.is-zero\\{background:#dd6a66\\}'));
    assert.doesNotMatch(html, new RegExp('\\.' + selector + '\\.empty\\{'));
  }
  assert.match(html, /class="stock-mark \$\{status==='empty'\?'is-zero':status\}"/);
  assert.match(html, /stockStatus\(x\)==='empty'\?'is-zero':stockStatus\(x\)/);
  assert.match(html, /class="legend-swatch is-zero"/);
});

test('inventory row geometry and business rules stay unchanged for every stock state', () => {
  assert.match(html, /\.stock-low,\.stock-empty\{background:var\(--surface\)\}/);
  assert.match(html, /\.inventory-item\{min-height:71px;gap:10px;padding:10px 12px/);
  assert.match(html, /function stockStatus\(x\)\{return x\.cycle&&x\.qty<x\.target\?\(x\.qty===0\?'empty':'low'\):'normal'\}/);
  assert.match(html, /\$\{x\.qty===0\?'disabled':''\}/);
});
