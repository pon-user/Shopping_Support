import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('history tabs, pagination and collapsible cards',()=>{
 assert.match(html,/const HISTORY_PAGE_SIZE=10/);
 assert.match(html,/historyFilteredLogs\(\)/);
 assert.match(html,/data-act="history-filter"/);
 assert.match(html,/data-act="history-toggle"/);
 assert.match(html,/data-act="history-prev"/);
 assert.match(html,/data-act="history-next"/);
 assert.match(html,/<details class="historyrow">/);
 assert.match(html,/\['adjust','undo'\]/);
});
test('dark-blue replaces cute while preserving legacy data compatibility',()=>{
 assert.match(html,/body\[data-theme="dark-blue"\]/);
 assert.match(html,/data-id="dark-blue"/);
 assert.doesNotMatch(html,/data-id="cute"/);
 assert.match(html,/if\(state\.theme==='cute'\)state\.theme='stylish'/);
 assert.match(html,/\['cute','stylish','dark-blue'\]\.includes\(v\.theme\)/);
 assert.match(html,/const KEY='shopping-support-ux-demo-v03'/);
});
