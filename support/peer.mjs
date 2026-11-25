import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// 本地合作方协议服务；不处理委托方的业务资格或额度。
export function createPeer(config, stateFile) {
  const fresh = () => ({ batches: {}, operations: {}, rules: {}, nextRevision: 1 });
  let state;
  try { state = JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = fresh(); }
  const save = () => {
    mkdirSync(dirname(stateFile), { recursive: true });
    writeFileSync(stateFile + '.tmp', JSON.stringify(state));
    renameSync(stateFile + '.tmp', stateFile);
  };
  const send = (res, status, value) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(value));
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw) > 1024 * 1024) return send(res, 413, { error: '资料过大' });
      }
      const body = raw ? JSON.parse(raw) : {};
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { status: 'ok', partner: config.name });
      if (req.method === 'PUT' && url.pathname === '/control/rules') {
        if (!body.id || !config.modes.includes(body.mode)) return send(res, 400, { error: '规则格式不符' });
        state.rules[body.id] = body.mode; save(); return send(res, 200, { id: body.id, mode: body.mode });
      }
      if (req.method === 'POST' && url.pathname === '/control/settle') {
        const operation = state.operations[body.id];
        if (!operation) return send(res, 404, { error: '未找到合作方流水' });
        if (!['confirmed', 'rejected', 'returned'].includes(body.status)) return send(res, 400, { error: '不支持的终态' });
        const requested = JSON.stringify({ status: body.status, details: body.details ?? {} });
        if (operation.terminalRequest && operation.terminalRequest !== requested) return send(res, 409, { error: '终态冲突，需另行更正事实' });
        if (!operation.terminalRequest) {
          Object.assign(operation, { status: body.status, details: body.details ?? {}, terminalRequest: requested, revision: state.nextRevision++ }); save();
        }
        return send(res, 200, operation);
      }
      if (req.method === 'GET' && url.pathname === '/control/state') return send(res, 200, state);
      if (req.method === 'GET' && url.pathname.startsWith(config.lookup)) {
        const id = decodeURIComponent(url.pathname.slice(config.lookup.length));
        const operation = state.operations[id];
        return send(res, operation ? 200 : 404, operation ?? { error: '未受理', id });
      }
      if (req.method === 'POST' && url.pathname === config.path) {
        const key = req.headers[config.key.toLowerCase()];
        const items = body[config.group];
        if (typeof key !== 'string' || !key || !Array.isArray(items) || !items.length || items.length > 100) return send(res, 400, { error: '请求键或逐项资料不符' });
        const ids = items.map(item => item?.[config.id]);
        if (ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,100}$/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) || new Set(ids).size !== ids.length) return send(res, 400, { error: '逐项编号不符或重复' });
        const fingerprint = JSON.stringify(items);
        const previous = state.batches[key];
        if (previous) return send(res, previous.fingerprint === fingerprint ? 200 : 409, previous.fingerprint === fingerprint ? { results: previous.ids.map(id => state.operations[id]) } : { error: '同一请求键对应不同资料' });
        for (const [index, id] of ids.entries()) {
          if (state.operations[id] && JSON.stringify(state.operations[id].input) !== JSON.stringify(items[index])) return send(res, 409, { error: '逐项编号对应不同资料', id });
        }
        let disconnect = false;
        for (const [index, id] of ids.entries()) {
          if (state.operations[id]) continue;
          const mode = state.rules[id] ?? 'accepted';
          disconnect ||= mode === 'accepted_disconnect';
          state.operations[id] = { id, status: mode === 'rejected' ? 'rejected' : mode === 'pending' ? 'pending' : 'accepted', input: items[index], revision: state.nextRevision++ };
        }
        state.batches[key] = { fingerprint, ids }; save();
        if (disconnect) return req.socket.destroy();
        return send(res, 202, { results: ids.map(id => state.operations[id]) });
      }
      return send(res, 404, { error: '没有对应的合作方接口' });
    } catch (error) {
      send(res, error instanceof SyntaxError ? 400 : 500, { error: error instanceof SyntaxError ? 'JSON 格式不符' : '合作方保存失败' });
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = JSON.parse(readFileSync(new URL('../fixtures/partner.json', import.meta.url), 'utf8'));
  const stateFile = process.env.PARTNER_STATE ?? '.local/partner.json';
  const server = createPeer(config, stateFile);
  server.listen(Number(process.env.PORT ?? 4317), '0.0.0.0', () => console.log(JSON.stringify({ message: '本地合作方已启动', port: server.address().port, stateFile })));
}
