# GameZone Arcade - Console Booking API

**Problem:** Console stations run first come, first served. Players queue for hours while some stations stay empty.
**Solution:** A booking system where gamers reserve a console for a date range, and anyone can ask "which consoles are free on this date?"

Built with **Express** and **SQLite** (the SQLite built into Node.js).

## How to run

Requires Node.js 22.13 or newer (no extra database install needed).

```bash
npm install
npm start          # server on http://localhost:3000
npm test           # runs the 3 twist tests + extras
```

The database file `gamezone.db` is created automatically on first start. Set `PORT` to change the port.

## Database (3 related tables)

| Table | Columns |
|---|---|
| `gamers` | id, name, email (unique) |
| `consoles` | id, name, platform |
| `bookings` | id, gamer_id (FK), console_id (FK), start_date, end_date |

Deleting a gamer or console also deletes their bookings (`ON DELETE CASCADE`).

## Endpoints

| Method | Route | Description | Success code |
|---|---|---|---|
| GET | `/gamers` | List all gamers | 200 |
| GET | `/gamers/:id` | Get one gamer | 200 |
| POST | `/gamers` | Add a gamer | 201 |
| PUT | `/gamers/:id` | Update a gamer | 200 |
| DELETE | `/gamers/:id` | Delete a gamer | 204 |
| GET | `/consoles` | List consoles. Search: `?platform=PS5`, `?name=...` | 200 |
| GET | `/consoles/:id` | Get one console | 200 |
| POST | `/consoles` | Add a console (name, platform) | 201 |
| PUT | `/consoles/:id` | Update a console | 200 |
| DELETE | `/consoles/:id` | Delete a console | 204 |
| GET | `/bookings` | List all bookings | 200 |
| GET | `/bookings/:id` | Get one booking | 200 |
| POST | `/bookings` | Add a booking | 201 |
| PUT | `/bookings/:id` | Update a booking | 200 |
| DELETE | `/bookings/:id` | Delete a booking | 204 |
| **GET** | **`/bookings/details`** | **Join: bookings with gamer name and console name** | 200 |
| **GET** | **`/consoles/available?date=YYYY-MM-DD`** | **Twist: consoles with no booking covering that date** | 200 |

Error codes: `400` validation error, `404` not found, `409` duplicate email or overlapping booking.

## Validation

All add and update requests are validated and return `{ "error": "message" }` with status 400, for example:

- `name is required and must be a non-empty string`
- `email must be a valid email address`
- `start_date is required and must be a real date in YYYY-MM-DD format`
- `end_date cannot be before start_date`

## The twist: Free on this date

A booking has a `start_date` and an `end_date`. An `end_date` before the `start_date` returns **400**.

`GET /consoles/available?date=YYYY-MM-DD` lists every console with no booking where `start_date <= date <= end_date` (both ends inclusive).

| Test | Scenario | Result |
|---|---|---|
| 1 | Booking with end before start | 400 |
| 2 | Console 4 booked 10 to 12 Nov, `available?date=2026-11-11` | 200, Console 4 missing |
| 3 | `available?date=2026-11-13` | 200, Console 4 listed |

Run `npm test` to check all three automatically.

## Example requests

```bash
curl -X POST localhost:3000/gamers -H "Content-Type: application/json" \
  -d '{"name":"Aarav","email":"aarav@example.com"}'

curl -X POST localhost:3000/consoles -H "Content-Type: application/json" \
  -d '{"name":"Console 4","platform":"PS5"}'

curl -X POST localhost:3000/bookings -H "Content-Type: application/json" \
  -d '{"gamer_id":1,"console_id":1,"start_date":"2026-11-10","end_date":"2026-11-12"}'

curl "localhost:3000/consoles/available?date=2026-11-11"
curl localhost:3000/bookings/details
```

## Project structure

```
server.js       Express setup, routes, status codes, join, twist endpoint
db.js           SQLite connection and the 3 tables
validators.js   Input checks and error messages
test.js         Automated tests for the 3 twist scenarios
```
