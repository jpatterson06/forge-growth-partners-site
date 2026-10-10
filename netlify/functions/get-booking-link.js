// Netlify Function: get-booking-link
// Public, read-only. Returns the current Cal.com booking link set by Jamal
// in the Forge Command Center's Settings tab (app_settings.cal_booking_url),
// or { url: null } if none is set — the site falls back to waitlist copy.
//
// Uses the service-role key server-side only; app_settings RLS only grants
// `authenticated`, so this function is the sanctioned public read-through.
//
// Required env vars (already set for submit-lead.js / submit-contact.js):
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'cal_booking_url')
      .maybeSingle();

    if (error) {
      console.error('get-booking-link: supabase error', error.message);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: null }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ url: (data && data.value) || null }),
    };
  } catch (err) {
    console.error('get-booking-link: unexpected error', err.message);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: null }) };
  }
};
