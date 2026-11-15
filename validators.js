// Part 4: Validation helpers - each returns an error message string, or null if valid

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

function validateGamer(body) {
  if (!body || !nonEmpty(body.name)) return 'name is required and must be a non-empty string';
  if (!nonEmpty(body.email)) return 'email is required and must be a non-empty string';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return 'email must be a valid email address';
  return null;
}

function validateConsole(body) {
  if (!body || !nonEmpty(body.name)) return 'name is required and must be a non-empty string';
  if (!nonEmpty(body.platform)) return 'platform is required and must be a non-empty string';
  return null;
}

function validateBooking(body) {
  if (!body) return 'request body is required';
  if (!Number.isInteger(body.gamer_id)) return 'gamer_id is required and must be an integer';
  if (!Number.isInteger(body.console_id)) return 'console_id is required and must be an integer';
  if (!isValidDate(body.start_date)) return 'start_date is required and must be a real date in YYYY-MM-DD format';
  if (!isValidDate(body.end_date)) return 'end_date is required and must be a real date in YYYY-MM-DD format';
  // TWIST RULE: end before start is not allowed
  if (body.end_date < body.start_date) return 'end_date cannot be before start_date';
  return null;
}

module.exports = { isValidDate, validateGamer, validateConsole, validateBooking };
