/*!
 * Timetrack shared analytics (timetrack.kz)
 * ---------------------------------------------------------------
 * Единая точка для маркетинговой аналитики на всех страницах:
 *  - Яндекс.Метрика 111411851: JS-цели wa_click / tel_click /
 *    tariff_click / register_success / trial_click
 *    (цели с ТАКИМИ ЖЕ именами создать в интерфейсе Метрики,
 *    тип «JavaScript-событие», иначе их не будет видно в Директе)
 *  - GA4 (gtag.js): те же события без дублей (один клик = одно событие)
 *  - Сохранение UTM + gclid / yclid на 30 дней (localStorage + cookie)
 *  - Метка источника в тексте WhatsApp: «… Timetrack [google]»
 *
 * GA4: отдельный поток Timetrack в ресурсе POSCENTER.
 * Google Ads: базовый тег POSCENTER; конверсии импортируются из GA4.
 * ADS_CONFIG.CONVERSIONS остаются пустыми: прямые conversion-вызовы
 * для тех же действий не нужны, иначе получится двойной учёт.
 */
(function () {
  'use strict';

  if (window.TT_Analytics) return;

  var YM_ID = 111411851;

  var GA4_CONFIG = {
    // Отдельный поток Timetrack (16043623769) в ресурсе POSCENTER (399855487).
    MEASUREMENT_ID: 'G-3XSE2HFZ45',
  };

  var ADS_CONFIG = {
    // Аккаунт POSCENTER 174-467-9551. Конверсии импортируются из GA4.
    ID: 'AW-1011683356',
    // Не отправляем прямые conversion-теги поверх импорта из GA4.
    CONVERSIONS: {
      wa_click: '',
      tel_click: '',
      register_success: '',
    },
  };

  var ATTR_KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'gclid',
    'yclid',
  ];
  var STORE_KEY = 'tt_attribution_v1';
  var COOKIE_NAME = 'tt_attrib';
  var TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 дней

  // --- small utils ---------------------------------------------------------

  function sanitize(value) {
    return String(value == null ? '' : value)
      .replace(/[\x00-\x1F\x7F]/g, '')
      .slice(0, 128);
  }

  function parseQuery() {
    var out = {};
    try {
      var params = new URLSearchParams(window.location.search);
      ATTR_KEYS.forEach(function (key) {
        var value = params.get(key);
        if (value !== null && value !== '') out[key] = sanitize(value);
      });
    } catch (e) {
      /* URLSearchParams недоступен — игнорируем */
    }
    return out;
  }

  function readStore() {
    var raw = null;
    try {
      raw = window.localStorage.getItem(STORE_KEY);
    } catch (e) {
      raw = null;
    }
    if (!raw) {
      try {
        var match = document.cookie.match(
          new RegExp('(?:^|;\\s*)' + COOKIE_NAME + '=([^;]*)')
        );
        if (match) raw = decodeURIComponent(match[1]);
      } catch (e) {
        raw = null;
      }
    }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.ts || Date.now() - parsed.ts > TTL_MS) return null;
      return parsed.data || {};
    } catch (e) {
      return null;
    }
  }

  function writeStore(data) {
    var payload = JSON.stringify({ ts: Date.now(), data: data });
    try {
      window.localStorage.setItem(STORE_KEY, payload);
    } catch (e) {
      /* приватный режим и т.п. — остаётся cookie */
    }
    try {
      var expires = new Date(Date.now() + TTL_MS).toUTCString();
      document.cookie =
        COOKIE_NAME +
        '=' +
        encodeURIComponent(payload) +
        '; max-age=' +
        TTL_MS / 1000 +
        '; expires=' +
        expires +
        '; path=/; SameSite=Lax';
    } catch (e) {
      /* cookie недоступны — остаётся localStorage */
    }
  }

  // --- attribution ---------------------------------------------------------

  function captureAttribution() {
    var fromUrl = parseQuery();
    if (Object.keys(fromUrl).length > 0) {
      writeStore(fromUrl);
      return fromUrl;
    }
    return readStore() || {};
  }

  var attribution = captureAttribution();

  function getAttribution() {
    var out = {};
    ATTR_KEYS.forEach(function (key) {
      if (attribution[key]) out[key] = attribution[key];
    });
    return out;
  }

  // Метка источника для текста WhatsApp (п.5 ТЗ).
  function sourceLabel() {
    var raw = (attribution.utm_source || '').toLowerCase();
    if (!raw) return 'сайт';
    if (raw.indexOf('google') !== -1) return 'google';
    if (raw.indexOf('yandex') !== -1 || raw.indexOf('direct') !== -1) {
      return 'yandex';
    }
    var safe = raw.replace(/[^a-z0-9а-яё._-]/gi, '').slice(0, 32);
    return safe || 'сайт';
  }

  function withSource(message) {
    // Идемпотентно: срезаем ранее добавленную метку («… Timetrack [google]»)
    // и висячий бренд в конце («…timetrack», возможно несколько раз подряд,
    // если renderPricing сработал до загрузки этого модуля). Лишний бренд
    // затем добавляется ровно один раз — как в ТЗ: «… Timetrack [google]».
    var base = String(message == null ? '' : message)
      .replace(/\s*\[[^\[\]]{1,32}\]\s*$/, '')
      .replace(/(\s*timetrack)+\s*$/i, '')
      .replace(/\s+$/, '');
    return base + ' Timetrack [' + sourceLabel() + ']';
  }

  function decorateWaLink(link) {
    try {
      var href = link.getAttribute('href') || '';
      if (href.indexOf('wa.me') === -1) return;
      var url = new URL(href, window.location.href);
      var text = url.searchParams.get('text');
      if (text === null) return;
      var wanted = withSource(text);
      if (text === wanted) return;
      url.searchParams.set('text', wanted);
      link.setAttribute('href', url.toString());
    } catch (e) {
      /* кривой href — не трогаем */
    }
  }

  function decorateAllWaLinks() {
    try {
      var links = document.querySelectorAll('a[href*="wa.me"]');
      for (var i = 0; i < links.length; i++) decorateWaLink(links[i]);
    } catch (e) {
      /* querySelectorAll недоступен — пропускаем */
    }
  }

  // --- event sending (без дублей: одно нажатие — одно событие) -------------

  // Общее окно идемпотентности: если по какой-то причине обработчик
  // сработает дважды (повторная вставка скрипта и т.п.), второе
  // срабатывание той же цели в пределах окна игнорируется.
  window.__tt_goal_last = window.__tt_goal_last || {};
  var DEDUP_WINDOW_MS = 500;

  function shouldSend(goal) {
    var now = Date.now();
    var last = window.__tt_goal_last[goal] || 0;
    if (now - last < DEDUP_WINDOW_MS) return false;
    window.__tt_goal_last[goal] = now;
    return true;
  }

  function sendYm(goal) {
    try {
      if (typeof window.ym === 'function') {
        window.ym(YM_ID, 'reachGoal', goal);
      }
    } catch (e) {
      /* Метрика заблокирована — не мешаем пользователю */
    }
  }

  function sendGa4(goal) {
    try {
      if (!GA4_CONFIG.MEASUREMENT_ID || typeof window.gtag !== 'function') {
        return;
      }
      var params = { send_to: GA4_CONFIG.MEASUREMENT_ID, source_label: sourceLabel(), page_path: window.location.pathname };
      var attr = getAttribution();
      Object.keys(attr).forEach(function (key) {
        params[key] = attr[key];
      });
      window.gtag('event', goal, params);
    } catch (e) {
      /* GA4 не настроен/заблокирован — пропускаем */
    }
  }

  function sendAds(goal) {
    try {
      var label =
        ADS_CONFIG.CONVERSIONS && ADS_CONFIG.CONVERSIONS[goal];
      if (!ADS_CONFIG.ID || !label || typeof window.gtag !== 'function') {
        return;
      }
      window.gtag('event', 'conversion', { send_to: label });
    } catch (e) {
      /* Ads не настроен — пропускаем */
    }
  }

  function trackGoal(goal) {
    if (!shouldSend(goal)) return;
    sendYm(goal);
    sendGa4(goal);
    sendAds(goal);
  }

  function trackRegisterSuccess() {
    trackGoal('register_success');
  }

  // --- click delegation: один слушатель на документ = один вызов на клик ---

  function isWaLink(href) {
    return /(^|\.)wa\.me(\/|$)/i.test(
      href.replace(/^https?:\/\//i, '').split('?')[0]
    );
  }

  function isTelTarget(href) {
    var match = /^tel:\s*\+?([^;?]+)/i.exec(href || '');
    if (!match) return false;
    return match[1].replace(/\D/g, '') === '77009111213';
  }

  function onDocumentClick(event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var anchor = target.closest('a[href]');
    if (!anchor || !document.contains(anchor)) return;
    var href = anchor.getAttribute('href') || '';

    // Порядок важен только для читаемости: каждая цель — свой вызов,
    // каждый вызов защищён окном идемпотентности.
    if (anchor.id === 'connect-tariff-link') trackGoal('tariff_click');
    if (isWaLink(href)) trackGoal('wa_click');
    if (isTelTarget(href)) trackGoal('tel_click');

    var trialHost = target.closest('[data-goal="trial_click"]');
    if (trialHost && (trialHost === anchor || trialHost.contains(anchor))) {
      trackGoal('trial_click');
    }
  }

  // --- GA4 / Ads loader (включается одной строкой в конфиге выше) ---------

  function loadGtag() {
    var gaId = GA4_CONFIG.MEASUREMENT_ID;
    if (!gaId) return;
    try {
      window.dataLayer = window.dataLayer || [];
      if (typeof window.gtag !== 'function') {
        window.gtag = function () {
          window.dataLayer.push(arguments);
        };
      }
      window.gtag('js', new Date());
      window.gtag('config', gaId, { page_path: window.location.pathname });
      if (ADS_CONFIG.ID) {
        window.gtag('config', ADS_CONFIG.ID, { send_page_view: false });
      }
      var script = document.createElement('script');
      script.async = true;
      script.src =
        'https://www.googletagmanager.com/gtag/js?id=' +
        encodeURIComponent(gaId);
      document.head.appendChild(script);
    } catch (e) {
      /* не смогли подключить gtag — цели Метрики всё равно работают */
    }
  }

  // --- public API ------------------------------------------------------------

  window.TT_Analytics = {
    YM_ID: YM_ID,
    getAttribution: getAttribution,
    sourceLabel: sourceLabel,
    withSource: withSource,
    decorateWaLink: decorateWaLink,
    track: trackGoal,
    trackRegisterSuccess: trackRegisterSuccess,
  };

  // --- init ------------------------------------------------------------------

  function init() {
    decorateAllWaLinks();
    // Страховочная сеть: renderPricing()/updateConsultationLinks() в
    // index.html пересоздают href wa.me-ссылок — доклеиваем метку обратно.
    try {
      var observer = new MutationObserver(function () {
        decorateAllWaLinks();
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['href'],
        subtree: true,
      });
    } catch (e) {
      /* MutationObserver недоступен — первичное декорирование уже сделано */
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('click', onDocumentClick, true);
  loadGtag();
})();
