import { isCalendarDate, json, restRequest, serverConfig } from '../lib/http.js';

const MAX_BODY_BYTES = 12000;

function cleanText(value, max) {
  return String(value || '').trim().slice(0, max);
}

async function readLimitedJson(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError('Missing request body.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      const error = new Error('Request is too large.');
      error.status = 413;
      throw error;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

async function verifyTurnstile(token, secret, remoteIp) {
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return json({ error: 'Cross-origin request rejected.' }, 403);
      }
    } catch {
      return json({ error: 'Cross-origin request rejected.' }, 403);
    }
  }
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return json({ error: 'JSON is required.' }, 415);
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY_BYTES) return json({ error: 'Request is too large.' }, 413);

  const secret = String(env.TURNSTILE_SECRET_KEY || '');
  if (!secret) return json({ error: 'Booking protection is not configured.' }, 503);

  let input;
  try {
    input = await readLimitedJson(request);
  } catch (error) {
    if (error?.status === 413) return json({ error: 'Request is too large.' }, 413);
    return json({ error: 'Invalid request body.' }, 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const contactName = cleanText(input.name, 120);
  const company = cleanText(input.company, 160);
  const email = cleanText(input.email, 254).toLowerCase();
  const phone = cleanText(input.phone, 50);
  const topic = cleanText(input.topic, 2000);
  const meetingType = String(input.meeting_type || '');
  const date = String(input.date || '');
  const slot = String(input.time || '');
  const turnstileToken = String(input.turnstile_token || '');

  if (contactName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || phone.length < 5 || !isCalendarDate(date)
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot)
      || !['video_call', 'factory_visit'].includes(meetingType)
      || !turnstileToken) {
    return json({ error: 'Please check the required booking details.' }, 400);
  }

  const remoteIp = request.headers.get('cf-connecting-ip') || '';
  try {
    const verified = await verifyTurnstile(turnstileToken, secret, remoteIp);
    if (!verified) return json({ error: 'Verification failed. Please try again.' }, 400);

    serverConfig(env);
    const response = await restRequest(env, 'rpc/create_booking', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        p_booking_date: date,
        p_slot_start: `${slot}:00`,
        p_contact_name: contactName,
        p_company: company,
        p_email: email,
        p_phone: phone,
        p_topic: topic,
        p_meeting_type: meetingType,
      }),
    });
    const result = await response.json().catch(() => null);
    if (response.status === 409 || response.status === 400) {
      return json({ error: 'That time is no longer available. Please choose another slot.' }, 409);
    }
    if (!response.ok) return json({ error: 'The appointment could not be saved.' }, 502);
    return json({ ok: true, id: result }, 201);
  } catch {
    return json({ error: 'The appointment service is temporarily unavailable.' }, 500);
  }
}
