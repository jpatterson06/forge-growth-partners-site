// Netlify Function: submit-lead
// Receives the gym-analysis quiz submission and writes it to Forge's
// Supabase project. Uses the service-role key (server-side only, never
// shipped to the browser) because `leads` RLS correctly only grants
// `authenticated` — anon inserts are blocked by design. This function is
// the sanctioned bypass.
//
// Required env vars (set in Netlify → Site settings → Environment variables):
//   SUPABASE_URL                = https://pzyfiygfrwatosxrmvzl.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = (service_role key, Supabase project settings → API — SECRET)

const { createClient } = require('@supabase/supabase-js');

const AGE_YEARS = {
  'Less than 1 year': 0.5,
  '1–3 years': 2,
  '3–7 years': 5,
  '7+ years': 10
};
const SIZE_MEMBERS = {
  'Under 50': 35,
  '50–100': 75,
  '100–200': 150,
  '200+': 250
};

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

  const { name, gym, location, style, age, size, email, phone, notes,
    challenges, crm, marketing, social, score, breakdown, opportunities,
    wantsStrategyCall, attribution, consent, consentText, consentAt } = body;

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('submit-lead: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server not configured' }) };
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  try {
    // 1. Core lead record
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .insert({
        source: 'website',
        lead_type: 'gym_owner',
        full_name: name || null,
        email,
        phone: phone || null,
        raw_form_data: { location, style, age, size, notes, challenges, crm, marketing,
          social, wants_strategy_call: !!wantsStrategyCall, ai_gym_health_score: score,
          score_breakdown: breakdown, opportunities_shown: opportunities,
          consent: { given: !!consent, text: consentText || null, at: consentAt || null,
            ip: event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || null } },
        first_touch_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (leadErr) throw leadErr;
    const leadId = lead.id;

    // 2. Gym profile (best-effort parse of the quiz's bucketed answers)
    const [city, state] = (location || '').split(',').map((s) => s && s.trim());
    await supabase.from('gym_profiles').insert({
      lead_id: leadId,
      gym_name: gym || null,
      city: city || null,
      state: state || null,
      years_in_business: AGE_YEARS[age] || null,
      active_members: SIZE_MEMBERS[size] || null,
      current_crm: (crm || []).join(', ') || null,
      biggest_pain: (challenges || []).join(', ') || null
    });

    // 3. Qualification responses — one row per quiz answer, for the record
    const qa = [
      ['discipline', 'Primary discipline', style],
      ['gym_age', 'How long open', age],
      ['gym_size', 'Active member count', size],
      ['challenges', 'Biggest challenges', (challenges || []).join(', ')],
      ['crm_tools', 'Current CRM/gym-management tools', (crm || []).join(', ')],
      ['marketing_tools', 'Current marketing tools', (marketing || []).join(', ')],
      ['social_presence', 'Social media presence', (social || []).join(', ')],
      ['notes', 'Additional notes', notes]
    ].filter(([, , answer]) => answer);

    if (qa.length) {
      await supabase.from('qualification_responses').insert(
        qa.map(([key, prompt, answer]) => ({
          lead_id: leadId,
          question_key: key,
          question_prompt: prompt,
          answer_raw: String(answer),
          answered_at: new Date().toISOString()
        }))
      );
    }

    // 4. Attribution — from the attribution-catcher payload, if present
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
    console.error('submit-lead error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to save lead' })
    };
  }
};
