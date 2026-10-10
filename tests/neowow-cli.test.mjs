import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkCliAccount, isLocalCliRequest, parseCliProfile } from '../src/lib/neowowCli.ts';

test('local CLI account endpoint rejects hosted and cross-origin requests', () => {
  assert.equal(isLocalCliRequest('http://localhost:8000/api/neowow/account', 'http://localhost:8000', 'same-origin'), true);
  assert.equal(isLocalCliRequest('http://127.0.0.1:8000/api/neowow/account', null, null), true);
  assert.equal(isLocalCliRequest('http://[::1]:8000/api/neowow/account', null, 'none'), true);
  for (const [url, origin, site] of [
    ['https://public.example/api/neowow/account', null, null],
    ['http://localhost.evil.example/api/neowow/account', null, null],
    ['http://localhost:8000/api/neowow/account', 'https://evil.example', 'cross-site'],
    ['http://localhost:8000/api/neowow/account', null, 'cross-site'],
    ['http://localhost:8000/api/neowow/account', 'http://localhost:9000', 'same-site'],
    ['invalid', null, null],
  ]) assert.equal(isLocalCliRequest(url, origin, site), false);
});

test('CLI profile returns only a bounded display name, never credentials or personal fields', async () => {
  const result = await checkCliAccount(async () => JSON.stringify({userId:'123',nickname:'Fei',apiKey:'PRIVATE',accessToken:'PRIVATE',email:'private@example.com',points:100}));
  assert.deepEqual(result, {status:'connected',nickname:'Fei'});
  assert.equal(parseCliProfile(JSON.stringify({userId:'123',nickname:'x'.repeat(200)})).nickname.length,80);
  for (const value of ['not JSON','null','{}','{"nickname":"fake"}']) assert.deepEqual(parseCliProfile(value),{status:'unavailable'});
});

test('missing CLI, missing Key, timeout and raw command errors produce safe distinct states', async () => {
  for(const [code, expected] of [['ENOENT','not-installed'],[3,'not-linked'],['ETIMEDOUT','unavailable'],[1,'unavailable']]){
    let attempts=0;
    const result = await checkCliAccount(async () => {attempts++;throw Object.assign(new Error('PRIVATE API KEY'),{code,stderr:'SECRET'});});
    assert.deepEqual(result,{status:expected});
    assert.equal(attempts,1);
  }
});
