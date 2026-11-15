// Part 1: Express server and routes
// Part 3: REST endpoints (CRUD + join)
// Part 5: Twist - "Free on this date"
const express = require('express');
const db = require('./db');
const { isValidDate, validateGamer, validateConsole, validateBooking } = require('./validators');

const app = express();
app.use(express.json());

// Malformed JSON -> clear 400 instead of a stack trace
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

const badId = (res) => res.status(400).json({ error: 'id must be a positive integer' });
const parseId = (v) => (/^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null);

app.get('/', (req, res) => {
  res.json({
    name: 'GameZone Arcade API',
    routes: ['/gamers', '/consoles', '/consoles/available?date=YYYY-MM-DD', '/bookings', '/bookings/details'],
  });
});

/* ------------------------------ GAMERS ------------------------------ */

app.get('/gamers', (req, res) => {
  res.json(db.prepare('SELECT * FROM gamers').all());
});

app.get('/gamers/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const row = db.prepare('SELECT * FROM gamers WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Gamer not found' });
  res.json(row);
});

app.post('/gamers', (req, res) => {
  const err = validateGamer(req.body);
  if (err) return res.status(400).json({ error: err });
  try {
    const info = db
      .prepare('INSERT INTO gamers (name, email) VALUES (?, ?)')
      .run(req.body.name.trim(), req.body.email.trim());
    res.status(201).json(db.prepare('SELECT * FROM gamers WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'A gamer with this email already exists' });
    throw e;
  }
});

app.put('/gamers/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const err = validateGamer(req.body);
  if (err) return res.status(400).json({ error: err });
  if (!db.prepare('SELECT id FROM gamers WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Gamer not found' });
  }
  try {
    db.prepare('UPDATE gamers SET name = ?, email = ? WHERE id = ?').run(req.body.name.trim(), req.body.email.trim(), id);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'A gamer with this email already exists' });
    throw e;
  }
  res.json(db.prepare('SELECT * FROM gamers WHERE id = ?').get(id));
});

app.delete('/gamers/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const info = db.prepare('DELETE FROM gamers WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Gamer not found' });
  res.status(204).send();
});

/* ----------------------------- CONSOLES ----------------------------- */

// Search by query parameter: GET /consoles?platform=PS5  (also ?name=...)
app.get('/consoles', (req, res) => {
  const where = [];
  const params = [];
  if (req.query.platform) {
    where.push('LOWER(platform) LIKE ?');
    params.push(`%${String(req.query.platform).toLowerCase()}%`);
  }
  if (req.query.name) {
    where.push('LOWER(name) LIKE ?');
    params.push(`%${String(req.query.name).toLowerCase()}%`);
  }
  const sql = 'SELECT * FROM consoles' + (where.length ? ' WHERE ' + where.join(' AND ') : '');
  res.json(db.prepare(sql).all(...params));
});

// TWIST: consoles with no booking covering the given date.
// Declared BEFORE /consoles/:id so "available" is not treated as an id.
app.get('/consoles/available', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD)' });
  if (!isValidDate(date)) return res.status(400).json({ error: 'date must be a real date in YYYY-MM-DD format' });
  const rows = db
    .prepare(
      `SELECT * FROM consoles c
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.console_id = c.id AND b.start_date <= ? AND b.end_date >= ?
       )`
    )
    .all(date, date);
  res.json(rows);
});

app.get('/consoles/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const row = db.prepare('SELECT * FROM consoles WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Console not found' });
  res.json(row);
});

app.post('/consoles', (req, res) => {
  const err = validateConsole(req.body);
  if (err) return res.status(400).json({ error: err });
  const info = db
    .prepare('INSERT INTO consoles (name, platform) VALUES (?, ?)')
    .run(req.body.name.trim(), req.body.platform.trim());
  res.status(201).json(db.prepare('SELECT * FROM consoles WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/consoles/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const err = validateConsole(req.body);
  if (err) return res.status(400).json({ error: err });
  const info = db
    .prepare('UPDATE consoles SET name = ?, platform = ? WHERE id = ?')
    .run(req.body.name.trim(), req.body.platform.trim(), id);
  if (info.changes === 0) return res.status(404).json({ error: 'Console not found' });
  res.json(db.prepare('SELECT * FROM consoles WHERE id = ?').get(id));
});

app.delete('/consoles/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const info = db.prepare('DELETE FROM consoles WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Console not found' });
  res.status(204).send();
});

/* ----------------------------- BOOKINGS ----------------------------- */

// JOIN endpoint: bookings with gamer name and console name
// Declared BEFORE /bookings/:id.
app.get('/bookings/details', (req, res) => {
  const rows = db
    .prepare(
      `SELECT b.id, b.start_date, b.end_date,
              g.id AS gamer_id,   g.name AS gamer_name,
              c.id AS console_id, c.name AS console_name, c.platform
       FROM bookings b
       JOIN gamers   g ON g.id = b.gamer_id
       JOIN consoles c ON c.id = b.console_id
       ORDER BY b.start_date`
    )
    .all();
  res.json(rows);
});

app.get('/bookings', (req, res) => {
  res.json(db.prepare('SELECT * FROM bookings').all());
});

app.get('/bookings/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Booking not found' });
  res.json(row);
});

// Shared checks for create/update: gamer + console exist, no overlapping booking
function checkBookingRefs(body, ignoreId = 0) {
  if (!db.prepare('SELECT id FROM gamers WHERE id = ?').get(body.gamer_id)) {
    return { status: 404, error: 'Gamer not found' };
  }
  if (!db.prepare('SELECT id FROM consoles WHERE id = ?').get(body.console_id)) {
    return { status: 404, error: 'Console not found' };
  }
  const clash = db
    .prepare(
      `SELECT id FROM bookings
       WHERE console_id = ? AND id != ? AND start_date <= ? AND end_date >= ?`
    )
    .get(body.console_id, ignoreId, body.end_date, body.start_date);
  if (clash) return { status: 409, error: 'Console is already booked for part of this date range' };
  return null;
}

app.post('/bookings', (req, res) => {
  const err = validateBooking(req.body);
  if (err) return res.status(400).json({ error: err });
  const problem = checkBookingRefs(req.body);
  if (problem) return res.status(problem.status).json({ error: problem.error });
  const info = db
    .prepare('INSERT INTO bookings (gamer_id, console_id, start_date, end_date) VALUES (?, ?, ?, ?)')
    .run(req.body.gamer_id, req.body.console_id, req.body.start_date, req.body.end_date);
  res.status(201).json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/bookings/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const err = validateBooking(req.body);
  if (err) return res.status(400).json({ error: err });
  if (!db.prepare('SELECT id FROM bookings WHERE id = ?').get(id)) {
    return res.status(404).json({ error: 'Booking not found' });
  }
  const problem = checkBookingRefs(req.body, id);
  if (problem) return res.status(problem.status).json({ error: problem.error });
  db.prepare('UPDATE bookings SET gamer_id = ?, console_id = ?, start_date = ?, end_date = ? WHERE id = ?').run(
    req.body.gamer_id, req.body.console_id, req.body.start_date, req.body.end_date, id
  );
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
});

app.delete('/bookings/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return badId(res);
  const info = db.prepare('DELETE FROM bookings WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Booking not found' });
  res.status(204).send();
});

/* ------------------------------ fallbacks ----------------------------- */

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`GameZone Arcade API running on http://localhost:${PORT}`));
}

module.exports = app;
