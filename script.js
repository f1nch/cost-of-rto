(() => {
  'use strict';

  const KM_PER_MILE = 1.609344;
  const L_PER_GAL = 3.785412;
  const MPG_CONST = 235.214583; // L/100km <-> mpg (US gallon)
  const CO2_KG_PER_LITRE_GASOLINE = 2.3477; // EPA/EIA: 8,887 g CO2 per gallon burned
  const CO2_KG_PER_PASSENGER_KM_TRANSIT = 0.1; // ~100 g/passenger-km, blended bus/rail average
  const CO2_KG_PER_TREE_YEAR = 22; // EPA: mature tree absorbs ~22 kg CO2/year

  const form = document.getElementById('calc-form');
  const number1 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

  // Sourced defaults per country, see the "Data sources" section in index.html for citations.
  const COUNTRY_DEFAULTS = {
    us: {
      unit: 'us',
      commuteMinutesEachWay: 27,        // BTS/Census average one-way commute
      commuteDistanceKmEachWay: 30,     // ~18.8mi, US Census ACS average one-way
      gasPricePerLitre: 0.99,           // ~$3.75/gal, EIA
      transitPerDay: 6,                 // typical major-city monthly pass / ~21 workdays
      annualSalary: 62608,              // BLS median full-time annual earnings, 2025
      taxRate: 0.25,                    // rough blended federal + state estimate
      currencyLocale: 'en-US',
      currencyCode: 'USD'
    },
    ca: {
      unit: 'metric',
      commuteMinutesEachWay: 23,        // StatCan national average, car commuters, 2021
      commuteDistanceKmEachWay: 8.7,    // StatCan median car-commute distance, 2016 Census
      gasPricePerLitre: 1.61,           // CAA/StatCan 2026 year-to-date average
      transitPerDay: 8,                 // TTC monthly pass / ~20 workdays
      annualSalary: 67282,              // StatCan average employment income, 2024
      taxRate: 0.30,                    // rough blended federal + provincial estimate
      currencyLocale: 'en-CA',
      currencyCode: 'CAD'
    }
  };

  function getCurrency(country) {
    const p = COUNTRY_DEFAULTS[country] || COUNTRY_DEFAULTS.us;
    return new Intl.NumberFormat(p.currencyLocale, { style: 'currency', currency: p.currencyCode, maximumFractionDigits: 0 });
  }

  const els = {}; // cache of form elements by id
  form.querySelectorAll('input[id], select[id]').forEach(el => { els[el.id] = el; });

  let currentUnit = 'us';
  let currentCountry = 'us';

  // ---------- Unit conversion ----------
  function distanceToCanonicalKm(v, unit) { return unit === 'us' ? v * KM_PER_MILE : v; }
  function distanceFromCanonicalKm(v, unit) { return unit === 'us' ? v / KM_PER_MILE : v; }
  function fuelEffToCanonicalL100(v, unit) { return unit === 'us' ? (v > 0 ? MPG_CONST / v : 0) : v; }
  function fuelEffFromCanonicalL100(v, unit) { return unit === 'us' ? (v > 0 ? MPG_CONST / v : 0) : v; }
  function gasPriceToCanonicalPerLitre(v, unit) { return unit === 'us' ? v / L_PER_GAL : v; }
  function gasPriceFromCanonicalPerLitre(v, unit) { return unit === 'us' ? v * L_PER_GAL : v; }
  function wearToCanonicalPerKm(v, unit) { return unit === 'us' ? v / KM_PER_MILE : v; }
  function wearFromCanonicalPerKm(v, unit) { return unit === 'us' ? v * KM_PER_MILE : v; }

  const UNIT_LABELS = {
    metric: {
      distance: 'Commute distance, each way (km)',
      gasPrice: 'Gas price ($/litre)',
      fuelEfficiency: 'Fuel efficiency (L/100 km)',
      wear: 'Vehicle wear & maintenance ($/km)'
    },
    us: {
      distance: 'Commute distance, each way (mi)',
      gasPrice: 'Gas price ($/gallon)',
      fuelEfficiency: 'Fuel efficiency (mpg)',
      wear: 'Vehicle wear & maintenance ($/mi)'
    }
  };

  function updateUnitLabels(unit) {
    document.querySelectorAll('[data-unit-label]').forEach(span => {
      const key = span.getAttribute('data-unit-label');
      span.textContent = UNIT_LABELS[unit][key];
    });
  }

  // ---------- Read / write state ----------
  function num(id) {
    const v = parseFloat(els[id].value);
    return Number.isFinite(v) ? v : 0;
  }

  function readCanonicalState() {
    const mode = form.elements['mode'].value;
    const incomeMode = form.elements['incomeMode'].value;
    return {
      officeDaysPerWeek: num('officeDaysPerWeek'),
      workWeeksPerYear: num('workWeeksPerYear'),
      commuteMinutesEachWay: num('commuteMinutesEachWay'),
      commuteDistanceKmEachWay: distanceToCanonicalKm(num('commuteDistanceEachWay'), currentUnit),
      mode,
      gasPricePerLitre: gasPriceToCanonicalPerLitre(num('gasPrice'), currentUnit),
      fuelEfficiencyLPer100Km: fuelEffToCanonicalL100(num('fuelEfficiency'), currentUnit),
      parkingPerDay: num('parkingPerDay'),
      tollsPerDay: num('tollsPerDay'),
      insuranceExtraPerMonth: num('insuranceExtraPerMonth'),
      wearPerKm: wearToCanonicalPerKm(num('wearPerDistance'), currentUnit),
      transitPerDay: num('transitPerDay'),
      stationParkingPerDay: num('stationParkingPerDay'),
      breakfastPerDay: num('breakfastPerDay'),
      lunchPerDay: num('lunchPerDay'),
      coffeePerDay: num('coffeePerDay'),
      snacksPerDay: num('snacksPerDay'),
      childcarePerDay: num('childcarePerDay'),
      clothingMonthly: num('clothingMonthly'),
      wfhExtraMonthly: num('wfhExtraMonthly'),
      incomeMode,
      annualSalary: num('annualSalary'),
      hourlyWage: num('hourlyWage'),
      timeValueMultiplier: parseFloat(els.timeValueMultiplier.value) || 0,
      taxRate: num('taxRate') / 100
    };
  }

  function applyCanonicalStateToDom(s, unit) {
    els.officeDaysPerWeek.value = s.officeDaysPerWeek;
    els.workWeeksPerYear.value = s.workWeeksPerYear;
    els.commuteMinutesEachWay.value = s.commuteMinutesEachWay;
    els.commuteDistanceEachWay.value = round(distanceFromCanonicalKm(s.commuteDistanceKmEachWay, unit), 1);
    form.elements['mode'].value = s.mode;
    els.gasPrice.value = round(gasPriceFromCanonicalPerLitre(s.gasPricePerLitre, unit), 2);
    els.fuelEfficiency.value = round(fuelEffFromCanonicalL100(s.fuelEfficiencyLPer100Km, unit), 1);
    els.parkingPerDay.value = s.parkingPerDay;
    els.tollsPerDay.value = s.tollsPerDay;
    els.insuranceExtraPerMonth.value = s.insuranceExtraPerMonth;
    els.wearPerDistance.value = round(wearFromCanonicalPerKm(s.wearPerKm, unit), 2);
    els.transitPerDay.value = s.transitPerDay;
    els.stationParkingPerDay.value = s.stationParkingPerDay;
    els.breakfastPerDay.value = s.breakfastPerDay;
    els.lunchPerDay.value = s.lunchPerDay;
    els.coffeePerDay.value = s.coffeePerDay;
    els.snacksPerDay.value = s.snacksPerDay;
    els.childcarePerDay.value = s.childcarePerDay;
    els.clothingMonthly.value = s.clothingMonthly;
    els.wfhExtraMonthly.value = s.wfhExtraMonthly;
    form.elements['incomeMode'].value = s.incomeMode;
    els.annualSalary.value = s.annualSalary;
    els.hourlyWage.value = s.hourlyWage;
    els.timeValueMultiplier.value = s.timeValueMultiplier;
    els.taxRate.value = round(s.taxRate * 100, 0);
  }

  function round(v, d) {
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  }

  // ---------- Compute ----------
  function compute(s) {
    const annualOfficeDays = s.officeDaysPerWeek * s.workWeeksPerYear;
    const roundTripKm = s.commuteDistanceKmEachWay * 2;
    const annualKm = roundTripKm * s.officeDaysPerWeek * s.workWeeksPerYear;

    let fuelOrTransitCost = 0;
    let parkingTollsCost = 0;
    let wearCost = 0;
    let insuranceCost = 0;
    let annualCO2Kg = 0;

    if (s.mode === 'car') {
      const annualLitres = annualKm * s.fuelEfficiencyLPer100Km / 100;
      fuelOrTransitCost = annualLitres * s.gasPricePerLitre;
      wearCost = annualKm * s.wearPerKm;
      insuranceCost = s.insuranceExtraPerMonth * 12;
      parkingTollsCost = (s.parkingPerDay + s.tollsPerDay) * annualOfficeDays;
      annualCO2Kg = annualLitres * CO2_KG_PER_LITRE_GASOLINE;
    } else {
      fuelOrTransitCost = s.transitPerDay * annualOfficeDays;
      parkingTollsCost = s.stationParkingPerDay * annualOfficeDays;
      annualCO2Kg = annualKm * CO2_KG_PER_PASSENGER_KM_TRANSIT;
    }

    const foodCost = (s.breakfastPerDay + s.lunchPerDay + s.coffeePerDay + s.snacksPerDay) * annualOfficeDays;
    const childcareCost = s.childcarePerDay * annualOfficeDays;
    const clothingCost = s.clothingMonthly * 12;
    const wfhOffset = s.wfhExtraMonthly * 12;

    const annualCashCost = fuelOrTransitCost + parkingTollsCost + wearCost + insuranceCost
      + foodCost + childcareCost + clothingCost - wfhOffset;

    const weeklyCommuteHours = (s.commuteMinutesEachWay * 2 * s.officeDaysPerWeek) / 60;
    const annualCommuteHours = weeklyCommuteHours * s.workWeeksPerYear;
    const annualCommuteDays = annualCommuteHours / 8;

    const hourlyRate = s.incomeMode === 'hourly' ? s.hourlyWage : (s.annualSalary / 2080);
    const annualTimeValue = annualCommuteHours * hourlyRate * s.timeValueMultiplier;

    const annualTotalCost = annualCashCost + annualTimeValue;
    const monthlyTotalCost = annualTotalCost / 12;
    const costPerOfficeDay = annualOfficeDays > 0 ? annualTotalCost / annualOfficeDays : 0;
    const preTaxRaiseNeeded = s.taxRate < 1 ? Math.max(0, annualTotalCost) / (1 - s.taxRate) : Math.max(0, annualTotalCost);

    const breakdown = [
      { label: s.mode === 'car' ? 'Fuel' : 'Transit fares', value: fuelOrTransitCost },
      { label: s.mode === 'car' ? 'Parking & tolls' : 'Station parking', value: parkingTollsCost },
      { label: 'Vehicle wear', value: wearCost, hideIfZero: true },
      { label: 'Insurance', value: insuranceCost, hideIfZero: true },
      { label: 'Food & coffee', value: foodCost },
      { label: 'Childcare', value: childcareCost, hideIfZero: true },
      { label: 'Clothing', value: clothingCost },
      { label: 'Time value', value: annualTimeValue, hideIfZero: true },
      { label: 'WFH costs offset', value: -wfhOffset, hideIfZero: true, negative: true }
    ].filter(row => !(row.hideIfZero && Math.abs(row.value) < 0.5));

    const annualCO2Tons = annualCO2Kg / 1000;
    const treesToOffset = annualCO2Kg / CO2_KG_PER_TREE_YEAR;

    return {
      annualOfficeDays, annualCommuteHours, weeklyCommuteHours, annualCommuteDays,
      annualCashCost, annualTimeValue, annualTotalCost, monthlyTotalCost, costPerOfficeDay,
      preTaxRaiseNeeded, breakdown, annualCO2Tons, treesToOffset
    };
  }

  // ---------- Render ----------
  function render(result) {
    const currency = getCurrency(currentCountry);
    document.getElementById('out-annual').textContent = currency.format(result.annualTotalCost) + '/year';
    document.getElementById('out-monthly-day').textContent =
      `${currency.format(result.monthlyTotalCost)}/month · ${currency.format(result.costPerOfficeDay)} per office day`;

    document.getElementById('out-hours-year').textContent = `${number1.format(result.annualCommuteHours)} hours/year`;
    document.getElementById('out-hours-week-val').textContent = number1.format(result.weeklyCommuteHours);
    document.getElementById('out-workdays-val').textContent = number1.format(result.annualCommuteDays);

    document.getElementById('out-breakeven').textContent = currency.format(result.preTaxRaiseNeeded);

    document.getElementById('out-co2').textContent = `${number1.format(result.annualCO2Tons)} tons CO2/year`;
    document.getElementById('out-trees').textContent =
      `Equivalent to ${number1.format(result.treesToOffset)} trees growing for a year to offset it`;

    renderBreakdown(result.breakdown, currency);
    renderShareText(result, currency);
  }

  function renderBreakdown(rows, currency) {
    const container = document.getElementById('breakdown');
    container.innerHTML = '';
    const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.value)));

    rows.forEach(row => {
      const pct = Math.max(2, Math.round((Math.abs(row.value) / maxAbs) * 100));
      const wrap = document.createElement('div');
      wrap.className = 'bd-row' + (row.negative ? ' bd-negative' : '');

      const label = document.createElement('span');
      label.className = 'bd-label';
      label.textContent = row.label;

      const track = document.createElement('div');
      track.className = 'bd-track';
      const fill = document.createElement('div');
      fill.className = 'bd-fill';
      fill.style.width = pct + '%';
      track.appendChild(fill);

      const value = document.createElement('span');
      value.className = 'bd-value';
      value.textContent = (row.negative ? '–' : '') + currency.format(Math.abs(row.value));

      wrap.appendChild(label);
      wrap.appendChild(track);
      wrap.appendChild(value);
      container.appendChild(wrap);
    });
  }

  function renderShareText(result, currency) {
    const text = `My estimated RTO cost: ${currency.format(result.annualTotalCost)}/year · ` +
      `${Math.round(result.annualCommuteHours)} commute hours/year · ` +
      `${number1.format(result.annualCO2Tons)} tons CO2/year\n` +
      `Returning to the office is not free. costofrto.com`;
    document.getElementById('share-text').value = text;
  }

  // ---------- URL sync ----------
  // Short, mnemonic query keys instead of full field names, so shared links
  // stay compact. Still a plain inspectable query string, just abbreviated.
  const PARAM_KEYS = {
    officeDaysPerWeek: 'd',
    workWeeksPerYear: 'w',
    commuteMinutesEachWay: 'cm',
    commuteDistanceKmEachWay: 'cd',
    mode: 'mo',
    gasPricePerLitre: 'gp',
    fuelEfficiencyLPer100Km: 'fe',
    parkingPerDay: 'pk',
    tollsPerDay: 'tl',
    insuranceExtraPerMonth: 'ins',
    wearPerKm: 'wr',
    transitPerDay: 'tr',
    stationParkingPerDay: 'sp',
    breakfastPerDay: 'bf',
    lunchPerDay: 'lu',
    coffeePerDay: 'cf',
    snacksPerDay: 'sn',
    childcarePerDay: 'cc',
    clothingMonthly: 'cl',
    wfhExtraMonthly: 'wf',
    incomeMode: 'im',
    annualSalary: 'sal',
    hourlyWage: 'hw',
    timeValueMultiplier: 'tv',
    taxRate: 'tx'
  };

  function syncURL(s) {
    const p = new URLSearchParams();
    Object.entries(s).forEach(([k, v]) => {
      const clean = typeof v === 'number' ? round(v, 4) : v;
      p.set(PARAM_KEYS[k] || k, clean);
    });
    p.set('u', currentUnit);
    p.set('co', currentCountry);
    history.replaceState(null, '', '?' + p.toString());
  }

  function parseURLState() {
    const p = new URLSearchParams(location.search);
    if (![...p.keys()].length) return null;
    const country = p.get('co') === 'ca' ? 'ca' : 'us';
    const profile = COUNTRY_DEFAULTS[country];
    const get = (k, fallback) => {
      const short = PARAM_KEYS[k];
      return p.has(short) ? parseFloat(p.get(short)) : fallback;
    };
    return {
      country,
      unit: p.get('u') === 'metric' ? 'metric' : (p.get('u') === 'us' ? 'us' : profile.unit),
      state: {
        officeDaysPerWeek: get('officeDaysPerWeek', 3),
        workWeeksPerYear: get('workWeeksPerYear', 48),
        commuteMinutesEachWay: get('commuteMinutesEachWay', profile.commuteMinutesEachWay),
        commuteDistanceKmEachWay: get('commuteDistanceKmEachWay', profile.commuteDistanceKmEachWay),
        mode: p.get('mo') === 'transit' ? 'transit' : 'car',
        gasPricePerLitre: get('gasPricePerLitre', profile.gasPricePerLitre),
        fuelEfficiencyLPer100Km: get('fuelEfficiencyLPer100Km', 8.5),
        parkingPerDay: get('parkingPerDay', 0),
        tollsPerDay: get('tollsPerDay', 0),
        insuranceExtraPerMonth: get('insuranceExtraPerMonth', 0),
        wearPerKm: get('wearPerKm', 0.12),
        transitPerDay: get('transitPerDay', profile.transitPerDay),
        stationParkingPerDay: get('stationParkingPerDay', 0),
        breakfastPerDay: get('breakfastPerDay', 0),
        lunchPerDay: get('lunchPerDay', 15),
        coffeePerDay: get('coffeePerDay', 4),
        snacksPerDay: get('snacksPerDay', 3),
        childcarePerDay: get('childcarePerDay', 0),
        clothingMonthly: get('clothingMonthly', 25),
        wfhExtraMonthly: get('wfhExtraMonthly', 0),
        incomeMode: p.get('im') === 'hourly' ? 'hourly' : 'salary',
        annualSalary: get('annualSalary', profile.annualSalary),
        hourlyWage: get('hourlyWage', round(profile.annualSalary / 2080, 1)),
        timeValueMultiplier: get('timeValueMultiplier', 0.5),
        taxRate: get('taxRate', profile.taxRate)
      }
    };
  }

  // ---------- Country profile ----------
  function applyCountryProfile(country) {
    const profile = COUNTRY_DEFAULTS[country];
    const s = readCanonicalState(); // read using current unit before switching
    s.commuteMinutesEachWay = profile.commuteMinutesEachWay;
    s.commuteDistanceKmEachWay = profile.commuteDistanceKmEachWay;
    s.gasPricePerLitre = profile.gasPricePerLitre;
    s.transitPerDay = profile.transitPerDay;
    s.annualSalary = profile.annualSalary;
    s.hourlyWage = round(profile.annualSalary / 2080, 1);
    s.taxRate = profile.taxRate;

    currentCountry = country;
    currentUnit = profile.unit;
    document.querySelector(`input[name="unit"][value="${currentUnit}"]`).checked = true;
    applyCanonicalStateToDom(s, currentUnit);
    updateUnitLabels(currentUnit);
  }

  // ---------- Visibility toggles ----------
  function updateModeVisibility(mode) {
    document.querySelectorAll('.mode-fields').forEach(el => {
      el.hidden = el.getAttribute('data-mode') !== mode;
    });
  }
  function updateIncomeVisibility(incomeMode) {
    document.querySelectorAll('.income-field').forEach(el => {
      el.hidden = el.getAttribute('data-income') !== incomeMode;
    });
  }

  // ---------- Main recalculation ----------
  function recalc() {
    const s = readCanonicalState();
    const result = compute(s);
    render(result);
    syncURL(s);
  }

  // ---------- Events ----------
  form.addEventListener('input', (e) => {
    if (e.target.name === 'mode') updateModeVisibility(e.target.value);
    if (e.target.name === 'incomeMode') updateIncomeVisibility(e.target.value);
    recalc();
  });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'unit' && e.target.value !== currentUnit) {
      const s = readCanonicalState(); // read using OLD unit before switching
      currentUnit = e.target.value;
      applyCanonicalStateToDom(s, currentUnit);
      updateUnitLabels(currentUnit);
      recalc();
    }
    if (e.target.name === 'country' && e.target.value !== currentCountry) {
      applyCountryProfile(e.target.value);
      recalc();
    }
  });

  document.getElementById('copy-text-btn').addEventListener('click', () => {
    copyToClipboard(document.getElementById('share-text').value, 'Text copied!');
  });
  document.getElementById('copy-link-btn').addEventListener('click', () => {
    copyToClipboard(location.href, 'Link copied!');
  });

  function copyToClipboard(text, message) {
    const showConfirm = (msg) => {
      const el = document.getElementById('copy-confirm');
      el.textContent = msg;
      setTimeout(() => { el.textContent = ''; }, 2000);
    };
    const fallbackCopy = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try {
        document.execCommand('copy');
        showConfirm(message);
      } catch {
        showConfirm('Copy failed. Select and copy manually.');
      }
      document.body.removeChild(ta);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => showConfirm(message), fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  // ---------- Custom number steppers ----------
  // Native spinner arrows can't be meaningfully restyled cross-browser, so
  // hide them (CSS) and replace with custom buttons that respect each
  // field's step/min/max and fire the same 'input' event recalc() listens for.
  function enhanceNumberInputs() {
    form.querySelectorAll('input[type="number"]').forEach(input => {
      const wrap = document.createElement('div');
      wrap.className = 'number-field';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);

      const steppers = document.createElement('div');
      steppers.className = 'num-steppers';

      const makeBtn = (label, symbol, dir) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'num-btn';
        btn.setAttribute('aria-label', label);
        btn.textContent = symbol;
        btn.addEventListener('click', () => bump(input, dir));
        return btn;
      };

      steppers.appendChild(makeBtn('Increase', '▲', 1));
      steppers.appendChild(makeBtn('Decrease', '▼', -1));
      wrap.appendChild(steppers);
    });
  }

  function bump(input, dir) {
    const step = parseFloat(input.step) || 1;
    const decimals = (String(step).split('.')[1] || '').length;
    const factor = Math.pow(10, decimals);
    let next = (parseFloat(input.value) || 0) + dir * step;
    next = Math.round(next * factor) / factor;
    if (input.min !== '' && next < parseFloat(input.min)) next = parseFloat(input.min);
    if (input.max !== '' && next > parseFloat(input.max)) next = parseFloat(input.max);
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // ---------- Init ----------
  function init() {
    const fromURL = parseURLState();
    if (fromURL) {
      currentCountry = fromURL.country;
      currentUnit = fromURL.unit;
      document.querySelector(`input[name="country"][value="${currentCountry}"]`).checked = true;
      document.querySelector(`input[name="unit"][value="${currentUnit}"]`).checked = true;
      applyCanonicalStateToDom(fromURL.state, currentUnit);
      form.elements['mode'].value = fromURL.state.mode;
      form.elements['incomeMode'].value = fromURL.state.incomeMode;
      updateUnitLabels(currentUnit);
    } else {
      applyCountryProfile(currentCountry);
    }
    updateModeVisibility(form.elements['mode'].value);
    updateIncomeVisibility(form.elements['incomeMode'].value);
    enhanceNumberInputs();
    recalc();
  }

  init();
})();
