/**
 * Forge Growth Partners — attribution catcher
 * Captures utm/click-id params on every page load, keeps first-touch fixed
 * and last-touch rolling, in localStorage + a 90-day cookie. Read by
 * gym-analysis.html and contact.html at submit time and sent to the
 * lead-capture functions.
 */
(function () {
  var KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term',
    'gclid','gbraid','wbraid','fbclid','msclkid'];

  function readTouch() {
    var params = new URLSearchParams(window.location.search);
    var touch = {
      source: params.get('utm_source') || null,
      medium: params.get('utm_medium') || null,
      campaign: params.get('utm_campaign') || null,
      content: params.get('utm_content') || null,
      term: params.get('utm_term') || null,
      gclid: params.get('gclid') || null,
      gbraid: params.get('gbraid') || null,
      wbraid: params.get('wbraid') || null,
      fbclid: params.get('fbclid') || null,
      msclkid: params.get('msclkid') || null,
      landing_url: window.location.href,
      referrer: document.referrer || null,
      at: new Date().toISOString()
    };
    var hasAny = KEYS.some(function (k) { return params.get(k); });
    return { touch: touch, hasAny: hasAny };
  }

  function getStored() {
    try { return JSON.parse(localStorage.getItem('forge_attribution') || 'null'); }
    catch (e) { return null; }
  }

  function store(data) {
    try { localStorage.setItem('forge_attribution', JSON.stringify(data)); } catch (e) {}
    try {
      var expires = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toUTCString();
      document.cookie = 'forge_attribution=' + encodeURIComponent(JSON.stringify(data)) +
        '; expires=' + expires + '; path=/; SameSite=Lax';
    } catch (e) {}
  }

  var existing = getStored();
  var result = readTouch();

  var record = existing || { first_touch: result.touch, last_touch: result.touch };
  if (!existing) {
    record = { first_touch: result.touch, last_touch: result.touch };
  } else if (result.hasAny) {
    record.last_touch = result.touch;
  }
  store(record);

  window.ForgeAttribution = record;
})();
