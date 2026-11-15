// Part 2: Database - 3 related tables
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(process.env.DB_FILE || 'gamezone.db');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS gamers (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS consoles (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT NOT NULL,
    platform TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    gamer_id   INTEGER NOT NULL,
    console_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date   TEXT NOT NULL,
    FOREIGN KEY (gamer_id)   REFERENCES gamers(id)   ON DELETE CASCADE,
    FOREIGN KEY (console_id) REFERENCES consoles(id) ON DELETE CASCADE
  );
`);

module.exports = db;
