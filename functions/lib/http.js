export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function serverConfig(env) {
  const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY || '');
  if (!base || !key) throw new Error('Server database credentials are not configured.');
  return { base, key };
}

export async function restRequest(env, path, init = {}) {
  const { base, key } = serverConfig(env);
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${base}/rest/v1/${path}`, { ...init, headers });
}

export async function getBookingSettings(env) {
  const response = await restRequest(env, 'booking_settings?select=*&id=eq.1');
  if (!response.ok) throw new Error('Could not read booking settings.');
  const rows = await response.json();
  if (!rows.length) throw new Error('Booking settings are missing.');
  return rows[0];
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function addCalendarDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayInZone(timeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function dateIsBookable(date, settings, now = new Date()) {
  if (!isCalendarDate(date)) return false;
  const today = todayInZone(settings.timezone || 'UTC', now);
  const lastDate = addCalendarDays(today, Number(settings.advance_days || 0));
  if (date < today || date > lastDate) return false;
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay() || 7;
  return Array.isArray(settings.working_days) && settings.working_days.includes(weekday);
}

export function slotsForDate(settings) {
  const toMinutes = (value) => {
    const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
    return hours * 60 + minutes;
  };
  const start = toMinutes(settings.start_time);
  const end = toMinutes(settings.end_time);
  const interval = Number(settings.slot_minutes);
  if (!Number.isFinite(interval) || interval < 15 || interval > 240 || end <= start) return [];
  const result = [];
  for (let minute = start; minute + interval <= end; minute += interval) {
    result.push(`${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`);
  }
  return result;
}
