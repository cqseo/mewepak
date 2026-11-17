import { dateIsBookable, getBookingSettings, json, restRequest, slotsForDate } from '../lib/http.js';

export async function onRequestGet({ request, env }) {
  const date = new URL(request.url).searchParams.get('date') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'A date in YYYY-MM-DD format is required.' }, 400);

  try {
    const settings = await getBookingSettings(env);
    if (!dateIsBookable(date, settings)) return json({ date, timezone: settings.timezone, slots: [] });

    const query = new URLSearchParams({
      select: 'slot_start,status',
      booking_date: `eq.${date}`,
      status: 'in.(pending,confirmed)',
    });
    const response = await restRequest(env, `appointments?${query.toString()}`);
    if (!response.ok) return json({ error: 'Could not read appointment availability.' }, 502);

    const bookings = await response.json();
    const counts = new Map();
    for (const booking of bookings) {
      const time = String(booking.slot_start).slice(0, 5);
      counts.set(time, (counts.get(time) || 0) + 1);
    }
    const slots = slotsForDate(settings).filter((time) => (counts.get(time) || 0) < settings.max_per_slot);
    return json({ date, timezone: settings.timezone, slots });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Availability is unavailable.' }, 500);
  }
}
