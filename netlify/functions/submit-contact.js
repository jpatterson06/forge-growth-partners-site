// Netlify Function: submit-contact
// Receives the contact.html form submission and writes it to the same
// Supabase `leads` table as the gym-analysis quiz (lead_type: 'gym_owner',
// source_detail: 'contact_form' to distinguish it from the quiz), via the
// service-role key for the same RLS-bypass reason as submit-lead.js.

const { createClient } = require('@supabase/supabase-js');

const SIZE_MEMBERS = { tiny: 15, small: 50, medium: 110, large: 200, xl: 300 };
// Revenue buckets stored as a representative midpoint (numeric column) so the
// sales dashboard can sort/filter by it; the raw bucket label is kept in
// raw_form_data and qualification_responses for exact display.
const REVENUE_MIDPOINT = {
  under5k: 3000,
  '5to15k': 10000,
  '15to30k': 22500,
  '30to60k': 45000,
  over60k: 75000
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

  const { name, gym, email, phone, size, revenue, decisionMaker, timeline,
    crm, referralSource, preferredContact, topic, message, attribution,
    consent, consentText, consentAt } = body;

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
        source_detail: 'contact_form',
        lead_type: 'gym_owner',
        full_name: name || null,
        email,
        phone: phone || null,
        next_action: 'Reply to contact form inquiry',
        raw_form_data: { channel: 'contact_form', gym, size, revenue, decisionMaker,
          timeline, crm, referralSource, preferredContact, topic, message,
          consent: { given: !!consent, text: consentText || null, at: consentAt || null,
            ip: event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || null } },
        first_touch_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (leadErr) throw leadErr;
    const leadId = lead.id;

    if (gym || size || revenue || (crm && crm.length)) {
      await supabase.from('gym_profiles').insert({
        lead_id: leadId,
        gym_name: gym || null,
        active_members: SIZE_MEMBERS[size] || null,
        monthly_revenue: REVENUE_MIDPOINT[revenue] || null,
        current_crm: (crm || []).join(', ') || null
      });
    }

    const qa = [
      ['topic', 'What they want to talk about', topic],
      ['decision_maker', "Are they the decision-maker?", decisionMaker],
      ['timeline', 'Timeline to start', timeline],
      ['referral_source', 'How they heard about us', referralSource],
      ['preferred_contact_method', 'Preferred contact method', preferredContact],
      ['revenue_range', 'Monthly gym revenue (self-reported range)', revenue],
      ['member_count_range', 'Active member count (self-reported range)', size],
      ['message', 'Message submitted with contact form', message]
    ].filter((row) => row[2]);

    if (qa.length) {
      await supabase.from('qualification_responses').insert(
        qa.map((row) => ({
          lead_id: leadId,
          question_key: row[0],
          question_prompt: row[1],
          answer_raw: String(row[2]),
          answered_at: new Date().toISOString()
        }))
      );
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
