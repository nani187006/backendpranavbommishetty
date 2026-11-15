// Part 5: The 3 twist tests from the brief. Run with: npm test
process.env.DB_FILE = ':memory:';
const app = require('./server');
const assert = require('assert');

const server = app.listen(0, async () => {
  const base = `http://localhost:${server.address().port}`;
  const call = async (method, path, body) => {
    const r = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    return { status: r.status, body: text ? JSON.parse(text) : null };
  };

  try {
    // Seed: 1 gamer, 4 consoles (so "Console 4" has id 4)
    const gamer = (await call('POST', '/gamers', { name: 'Aarav', email: 'aarav@example.com' })).body;
    for (const [name, platform] of [['Console 1', 'PS5'], ['Console 2', 'Xbox'], ['Console 3', 'Switch'], ['Console 4', 'PS5']]) {
      await call('POST', '/consoles', { name, platform });
    }

    // Test 1: end before start -> 400
    let r = await call('POST', '/bookings', { gamer_id: gamer.id, console_id: 4, start_date: '2026-11-12', end_date: '2026-11-10' });
    assert.strictEqual(r.status, 400);
    console.log('Test 1 PASS: end before start ->', r.status, r.body.error);

    // Test 2: Console 4 booked 10-12 Nov; available?date=11 Nov -> 200, Console 4 missing
    r = await call('POST', '/bookings', { gamer_id: gamer.id, console_id: 4, start_date: '2026-11-10', end_date: '2026-11-12' });
    assert.strictEqual(r.status, 201);
    r = await call('GET', '/consoles/available?date=2026-11-11');
    assert.strictEqual(r.status, 200);
    assert.ok(!r.body.some((c) => c.id === 4), 'Console 4 should be missing');
    console.log('Test 2 PASS: 11 Nov ->', r.status, 'Console 4 missing; listed:', r.body.map((c) => c.name).join(', '));

    // Test 3: available?date=13 Nov -> 200, Console 4 listed
    r = await call('GET', '/consoles/available?date=2026-11-13');
    assert.strictEqual(r.status, 200);
    assert.ok(r.body.some((c) => c.id === 4), 'Console 4 should be listed');
    console.log('Test 3 PASS: 13 Nov ->', r.status, 'Console 4 listed');

    // Extras: join, search, validation, 404
    r = await call('GET', '/bookings/details');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body[0].gamer_name, 'Aarav');
    assert.strictEqual(r.body[0].console_name, 'Console 4');
    r = await call('GET', '/consoles?platform=ps5');
    assert.strictEqual(r.body.length, 2);
    r = await call('POST', '/consoles', { name: '' });
    assert.strictEqual(r.status, 400);
    r = await call('GET', '/consoles/999');
    assert.strictEqual(r.status, 404);
    r = await call('DELETE', '/consoles/3');
    assert.strictEqual(r.status, 204);
    console.log('Extras PASS: join, search, validation, 404, delete');
    console.log('\nALL TESTS PASSED');
  } catch (e) {
    console.error('TEST FAILED:', e.message);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
