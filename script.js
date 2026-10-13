'use strict';

// BioLoop is an educational screening model. Values are estimates, not measured plant data.
// The theoretical methane factor used here is 0.35 m³ CH4 per kg COD removed at standard conditions.
const COD_METHANE_FACTOR = 0.35; // m³ CH4 / kg COD removed (theoretical stoichiometric relationship)
const METHANE_LHV_KWH_M3 = 9.97; // approximate lower heating value, kWh per m³ methane
const PRESETS = {
  food: { cod: 0.15, removal: 70, recovery: 85, methane: 60 },
  manure: { cod: 0.06, removal: 55, recovery: 75, methane: 60 },
  crop: { cod: 0.20, removal: 45, recovery: 65, methane: 55 },
  custom: null
};
const $ = (id) => document.getElementById(id);
const inputIds = ['wasteKg','codLoad','codRemoval','recovery','methaneShare','efficiency','parasitic','electricityRate','operatingCost'];
const originalValues = {
  feedstock: 'food', wasteKg: '500', codLoad: '0.15', codRemoval: '70', recovery: '85', methaneShare: '60',
  efficiency: '0.35', parasitic: '0.10', electricityRate: '8', operatingCost: '1200'
};

const number = (id) => {
  const raw = Number($(id).value);
  return Number.isFinite(raw) ? raw : 0;
};
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmt = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }) : '—';
const inr = (v) => (v < 0 ? '−₹' : '₹') + fmt(Math.abs(v), 0);

function getModel(overrides = {}) {
  const wasteKg = Math.max(0, number('wasteKg'));
  const codLoad = clamp(number('codLoad'), 0, 2);
  const codRemoval = clamp(overrides.removal ?? number('codRemoval'), 0, 0.95);
  const recovery = clamp(overrides.recovery ?? number('recovery') / 100, 0, 1);
  const methaneShare = clamp(number('methaneShare') / 100, 0.01, 1);
  const efficiency = clamp(number('efficiency'), 0, 0.6);
  const parasitic = clamp(number('parasitic'), 0, 0.8);
  const electricityRate = Math.max(0, number('electricityRate'));
  const operatingCost = Math.max(0, number('operatingCost'));

  const codIn = wasteKg * codLoad;
  const codRemoved = codIn * codRemoval;
  // Factor 0.35 is a theoretical upper relationship; recovery is an explicit user-set derating.
  const methaneM3 = codRemoved * COD_METHANE_FACTOR * recovery;
  const biogasM3 = methaneM3 / methaneShare;
  const grossEnergy = methaneM3 * METHANE_LHV_KWH_M3;
  const grossElectricity = grossEnergy * efficiency;
  const netElectricity = grossElectricity * (1 - parasitic);
  const revenue = netElectricity * electricityRate;
  const netDaily = revenue - operatingCost;
  return { wasteKg, codLoad, codIn, codRemoved, codRemoval, recovery, methaneShare, methaneM3, biogasM3, grossEnergy, grossElectricity, netElectricity, revenue, operatingCost, netDaily };
}

function render() {
  $('codRemovalValue').textContent = `${number('codRemoval')}%`;
  $('recoveryValue').textContent = `${number('recovery')}%`;
  $('methaneShareValue').textContent = `${number('methaneShare')}%`;
  const m = getModel();
  $('methaneOut').innerHTML = `${fmt(m.methaneM3)} <small>m³/day</small>`;
  $('biogasOut').innerHTML = `${fmt(m.biogasM3)} <small>m³/day</small>`;
  $('grossEnergyOut').innerHTML = `${fmt(m.grossEnergy)} <small>kWh/day</small>`;
  $('netElectricityOut').innerHTML = `${fmt(m.netElectricity)} <small>kWh/day</small>`;
  $('gasTrack').style.width = `${clamp(m.methaneShare * 100, 0, 100)}%`;
  $('revenueOut').textContent = inr(m.revenue);
  $('netOut').textContent = inr(m.netDaily);
  $('netOut').classList.toggle('negative', m.netDaily < 0);
  $('decisionOut').textContent = m.netDaily >= 0 ? 'Positive before capital costs' : 'Not covering daily operating cost';

  const scenarios = [
    { key: 'low', label: 'Low case', sub: '60% recovery', recovery: 0.60 },
    { key: 'central', label: 'Central', sub: `${Math.round(m.recovery * 100)}% recovery`, recovery: m.recovery },
    { key: 'high', label: 'High case', sub: '95% recovery', recovery: 0.95 }
  ].map(s => ({ ...s, methane: m.codRemoved * COD_METHANE_FACTOR * s.recovery }));
  const max = Math.max(0.001, ...scenarios.map(s => s.methane));
  $('scenarioList').innerHTML = scenarios.map(s => `
    <div class="scenario-row ${s.key}">
      <div class="scenario-name">${s.label}<small>${s.sub}</small></div>
      <div class="scenario-track" role="img" aria-label="${s.label} relative methane output"><div class="scenario-bar" style="width:${clamp(s.methane / max * 100, 0, 100)}%"></div></div>
      <div class="scenario-amount">${fmt(s.methane)} m³ CH₄</div>
    </div>`).join('');
}

function applyPreset(key) {
  const preset = PRESETS[key];
  if (!preset) return;
  $('codLoad').value = preset.cod;
  $('codRemoval').value = preset.removal;
  $('recovery').value = preset.recovery;
  $('methaneShare').value = preset.methane;
  render();
}

$('feedstock').addEventListener('change', (event) => applyPreset(event.target.value));
inputIds.forEach(id => $(id).addEventListener('input', () => {
  if (id === 'codLoad') $('feedstock').value = 'custom';
  render();
}));
$('resetBtn').addEventListener('click', () => {
  Object.entries(originalValues).forEach(([id, value]) => { $(id).value = value; });
  render();
});
render();
