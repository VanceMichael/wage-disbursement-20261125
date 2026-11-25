import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPeer } from '../support/peer.mjs';

const config = JSON.parse(await readFile(new URL('../fixtures/partner.json', import.meta.url)));
const fixtures = JSON.parse(await readFile(new URL('../fixtures/records.json', import.meta.url)));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
const close = server => new Promise(resolve => server.close(resolve));

test('资料中同类编号唯一，角色与实体资料可读取', () => {
  assert.ok(fixtures.actors.length >= 3);
  for (const rows of Object.values(fixtures)) {
    if (!Array.isArray(rows)) continue;
    const ids = rows.filter(row => row && typeof row === 'object' && row.id).map(row => row.id);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('合作方逐项受理、断线后查询、同键冲突及重启保留', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'partner-'));
  const stateFile = join(dir, 'state.json');
  let server = createPeer(config, stateFile);
  let base = await listen(server);
  const request = async (path, body, method = 'POST', key = 'request-a') => fetch(base + path, {
    method, headers: { 'Content-Type': 'application/json', [config.key]: key }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000)
  });
  try {
    assert.equal((await fetch(base + '/health')).status, 200);
    await request('/control/rules', { id: 'item-drop', mode: 'accepted_disconnect' }, 'PUT');
    await request('/control/rules', { id: 'item-no', mode: 'rejected' }, 'PUT');
    const items = [{ [config.id]: 'item-drop', amount: 10 }, { [config.id]: 'item-no', amount: 20 }];
    await assert.rejects(() => request(config.path, { [config.group]: items }));
    assert.equal((await (await fetch(base + config.lookup + 'item-drop')).json()).status, 'accepted');
    assert.equal((await (await fetch(base + config.lookup + 'item-no')).json()).status, 'rejected');
    assert.equal((await request(config.path, { [config.group]: items })).status, 200);
    assert.equal((await request(config.path, { [config.group]: [{ [config.id]: 'changed' }] })).status, 409);
    await close(server);
    server = createPeer(config, stateFile); base = await listen(server);
    assert.equal((await (await fetch(base + config.lookup + 'item-drop')).json()).status, 'accepted');
    assert.equal((await request('/control/settle', { id: 'item-drop', status: 'confirmed', details: { receipt: 'receipt-1' } })).status, 200);
    const revision = (await (await fetch(base + config.lookup + 'item-drop')).json()).revision;
    await request('/control/settle', { id: 'item-drop', status: 'confirmed', details: { receipt: 'receipt-1' } });
    assert.equal((await (await fetch(base + config.lookup + 'item-drop')).json()).revision, revision);
    assert.equal((await request('/control/settle', { id: 'item-drop', status: 'returned' })).status, 409);
    assert.equal((await fetch(base + config.lookup + 'unknown')).status, 404);
  } finally { await close(server); await rm(dir, { recursive: true, force: true }); }
});
