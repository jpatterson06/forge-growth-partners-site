// Netlify Function: submit-contact
// Receives the contact.html form submission and writes it to the same
// Supabase `leads` table as the gym-analysis quiz (lead_type: 'contact_form'),
// via the service-role key for the same RLS-bypass reason as submit-lead.js.

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, gym, email, phone, topic, message, attribution } = body;

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('submit-contact: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  try {
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        source: 'website',
        lead_type: 'contact_form',
        full_name: name || null,
        email,
        phone: phone || null,
        raw_form_data: { gym, topic, message },
        first_touch_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (leadErr) throw leadErr;
    const leadId = lead.id;

    if (gym) {
      await supabase.from('gym_profiles').insert({ lead_id: leadId, gym_name: gym });
    }

    if (attribution && (attribution.first_touch || attribution.last_touch)) {
      const ft = attribution.first_touch || {};
      const lt = attribution.last_touch || ft;
      await supabase.from('lead_attribution').insert({
        lead_id: leadId,
        ft_source: ft.source, ft_medium: ft.medium, ft_campaign: ft.campaign,
        ft_content: ft.content, ft_term: ft.term, ft_gclid: ft.gclid,
        ft_gbraid: ft.gbraid, ft_wbraid: ft.wbraid, ft_fbclid: ft.fbclid,
        ft_msclkid: ft.msclkid, ft_landing_url: ft.landing_url, ft_referrer: ft.referrer,
        ft_at: ft.at,
        lt_source: lt.source, lt_medium: lt.medium, lt_campaign: lt.campaign,
        lt_content: lt.content, lt_term: lt.term, lt_gclid: lt.gclid,
        lt_gbraid: lt.gbraid, lt_wbraid: lt.wbraid, lt_fbclid: lt.fbclid,
        lt_msclkid: lt.msclkid, lt_landing_url: lt.landing_url, lt_referrer: lt.referrer,
        lt_at: lt.at,
        raw: attribution
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, leadId })
    };
  } catch (err) {
    console.error('submit-contact error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to save message' })
    };
  }
};
