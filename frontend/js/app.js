/* =========================================================
   AquaWatch Pro — Intelligent Dashboard Engine & Telemetry System
   ========================================================= */

// ---------------------- CONFIGURATION & STATE ----------------------
const API_BASE_URL = window.location.origin && window.location.origin.startsWith('http')
  ? `${window.location.origin}/api/v1`
  : 'http://localhost:8080/api/v1';

let pollIntervalMs = 10000;
let pollTimer = null;
let autoSimTimer = null;
let isAudioEnabled = true;
let isSimulatorOpen = true;
let isDemoMode = false;
let currentChartFilter = 'all';
let currentChartLimit = 30;
let historyPage = 0;
const HISTORY_PAGE_SIZE = 10;
let historyTotalPages = 1;
let rawHistoryData = [];
let trendChart = null;
let lastKnownReading = null;
let activeAlerts = [];

// Safe Water Quality Guidelines (WHO & BIS Standards)
const THRESHOLDS = {
  ph: { min: 6.5, max: 8.5, ideal: 7.2, absMax: 14.0 },
  tds: { min: 50.0, max: 500.0, ideal: 200.0, absMax: 1000.0 },
  turbidity: { min: 0.0, max: 5.0, ideal: 1.0, absMax: 20.0 },
  temperature: { min: 10.0, max: 35.0, ideal: 24.0, absMax: 50.0 }
};

// ---------------------- DOM REFERENCES ----------------------
const connIndicator = document.getElementById('connIndicator');
const connText = document.getElementById('connText');
const clockEl = document.getElementById('clock');
const lastUpdatedEl = document.getElementById('lastUpdated');
const deviceIdLabel = document.getElementById('deviceIdLabel');

const statusBanner = document.getElementById('statusBanner');
const statusWord = document.getElementById('statusWord');
const statusRemarks = document.getElementById('statusRemarks');

const wqiScoreEl = document.getElementById('wqiScore');
const wqiRatingEl = document.getElementById('wqiRating');
const wqiCategoryEl = document.getElementById('wqiCategory');
const wqiRingEl = document.getElementById('wqiRing');

const relayIndicator = document.getElementById('relayIndicator');
const relayText = document.getElementById('relayText');
const relayCaption = document.getElementById('relayCaption');
const manualRelayToggleBtn = document.getElementById('manualRelayToggleBtn');
const manualRelayBtnText = document.getElementById('manualRelayBtnText');

const simulatorToolbar = document.getElementById('simulatorToolbar');
const toggleSimBarBtn = document.getElementById('toggleSimBarBtn');
const soundToggleBtn = document.getElementById('soundToggleBtn');
const soundIconOn = document.getElementById('soundIconOn');
const soundIconOff = document.getElementById('soundIconOff');
const soundText = document.getElementById('soundText');
const manualRefreshBtn = document.getElementById('manualRefreshBtn');
const refreshSpinner = document.getElementById('refreshSpinner');
const pollIntervalSelect = document.getElementById('pollIntervalSelect');

const simSafeBtn = document.getElementById('simSafeBtn');
const simSpikeBtn = document.getElementById('simSpikeBtn');
const simAutoToggleBtn = document.getElementById('simAutoToggleBtn');
const simAutoText = document.getElementById('simAutoText');
const simResetBtn = document.getElementById('simResetBtn');

const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const tableSearchInput = document.getElementById('tableSearchInput');
const statusFilterSelect = document.getElementById('statusFilterSelect');
const clearAlertsBtn = document.getElementById('clearAlertsBtn');
const alertFeedList = document.getElementById('alertFeedList');
const toastContainer = document.getElementById('toastContainer');

// ---------------------- AUDIO SYNTHESIZER (Web Audio API) ----------------------
class SoundEffects {
  constructor() {
    this.ctx = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playAlarm() {
    if (!isAudioEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(659.25, now + 0.15);
      osc.frequency.setValueAtTime(880, now + 0.3);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playSafeChime() {
    if (!isAudioEnabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.25); // G5

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.005, now + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }
}
const sfx = new SoundEffects();

// ---------------------- CLOCK ----------------------
function updateClock() {
  const now = new Date();
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
setInterval(updateClock, 1000);
updateClock();

// ---------------------- TOAST NOTIFICATIONS ----------------------
function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-dot ${type === 'safe' ? 'green' : type === 'unsafe' ? 'red' : 'blue'}"></span>
    <span class="toast-msg">${message}</span>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ---------------------- WATER QUALITY INDEX (WQI) CALCULATION ----------------------
/**
 * Calculates a composite Water Quality Index (0 - 100)
 * Higher = Cleaner & safer potable water.
 */
function calculateWQI(ph, tds, turbidity, temp) {
  if (ph == null || tds == null || turbidity == null || temp == null) {
    return { score: 0, rating: 'No Data', category: 'Pending Sensor Stream', color: '#8ba5b0' };
  }

  // pH sub-index (ideal = 7.0 - 7.5)
  const phDiff = Math.abs(ph - 7.2);
  const qPh = Math.max(0, 100 - (phDiff * 45));

  // TDS sub-index (< 300 ppm is excellent, > 500 is unsafe)
  let qTds = 100;
  if (tds > 150) {
    qTds = Math.max(0, 100 - ((tds - 150) / 4.5));
  }

  // Turbidity sub-index (< 1.0 NTU is excellent, > 5.0 is dirty)
  let qTurb = 100;
  if (turbidity > 0.5) {
    qTurb = Math.max(0, 100 - ((turbidity - 0.5) * 18));
  }

  // Temperature sub-index (20 - 25 C optimal)
  const tempDiff = Math.abs(temp - 24.0);
  const qTemp = Math.max(0, 100 - (tempDiff * 3.5));

  // Weighted aggregate index
  // pH weight: 0.35, Turbidity: 0.30, TDS: 0.25, Temp: 0.10
  const composite = (qPh * 0.35) + (qTurb * 0.30) + (qTds * 0.25) + (qTemp * 0.10);
  const score = Math.round(Math.min(100, Math.max(0, composite)));

  let rating = 'Excellent';
  let category = 'Grade A — Premium Drinking Quality';
  let color = '#10b981';

  if (score >= 90) {
    rating = 'Excellent';
    category = 'Grade A — Premium Potable Water';
    color = '#10b981';
  } else if (score >= 75) {
    rating = 'Good';
    category = 'Grade B — Standard Drinking Quality';
    color = '#00f2fe';
  } else if (score >= 55) {
    rating = 'Moderate';
    category = 'Grade C — Filtration Recommended';
    color = '#f59e0b';
  } else {
    rating = 'Critical / Unsafe';
    category = 'Grade D — Purification Required';
    color = '#ef4444';
  }

  return { score, rating, category, color };
}

function updateWQIMeter(wqi) {
  if (!wqiScoreEl) return;
  wqiScoreEl.textContent = wqi.score;
  wqiRatingEl.textContent = wqi.rating;
  wqiRatingEl.style.color = wqi.color;
  wqiCategoryEl.textContent = wqi.category;

  if (wqiRingEl) {
    // Total circumference is ~314 (2 * PI * 50)
    const maxOffset = 314;
    const offset = maxOffset - (wqi.score / 100) * maxOffset;
    wqiRingEl.style.strokeDashoffset = offset;
    wqiRingEl.style.stroke = wqi.color;
  }
}

// ---------------------- FETCH HELPER WITH DEMO FALLBACK ----------------------
async function apiGet(path) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (!body.success) throw new Error(body.message || 'API failure');
    isDemoMode = false;
    return body.data;
  } catch (err) {
    // If backend is unreachable, fallback to simulation mode seamlessly
    isDemoMode = true;
    return getLocalDemoData(path);
  }
}

async function apiPost(path, payload) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return body.data;
  } catch (err) {
    isDemoMode = true;
    return ingestLocalReading(payload);
  }
}

// ---------------------- LOCAL IN-MEMORY DEMO ENGINE ----------------------
const demoDb = {
  readings: [
    { id: 1, deviceId: 'ESP32-01', phValue: 7.15, tdsValue: 220.0, turbidityValue: 1.8, temperatureValue: 24.5, status: 'SAFE', relayStatus: 'OFF', recordedAt: new Date(Date.now() - 3600000 * 4).toISOString() },
    { id: 2, deviceId: 'ESP32-01', phValue: 7.10, tdsValue: 240.0, turbidityValue: 2.1, temperatureValue: 24.8, status: 'SAFE', relayStatus: 'OFF', recordedAt: new Date(Date.now() - 3600000 * 3).toISOString() },
    { id: 3, deviceId: 'ESP32-01', phValue: 6.95, tdsValue: 460.0, turbidityValue: 3.2, temperatureValue: 25.2, status: 'SAFE', relayStatus: 'OFF', recordedAt: new Date(Date.now() - 3600000 * 2).toISOString() },
    { id: 4, deviceId: 'ESP32-01', phValue: 5.80, tdsValue: 540.0, turbidityValue: 7.8, temperatureValue: 27.0, status: 'UNSAFE', relayStatus: 'ON', recordedAt: new Date(Date.now() - 3600000 * 1).toISOString() },
    { id: 5, deviceId: 'ESP32-01', phValue: 7.20, tdsValue: 280.0, turbidityValue: 2.0, temperatureValue: 24.6, status: 'SAFE', relayStatus: 'OFF', recordedAt: new Date(Date.now() - 600000).toISOString() },
    { id: 6, deviceId: 'ESP32-01', phValue: 7.18, tdsValue: 235.0, turbidityValue: 1.6, temperatureValue: 24.2, status: 'SAFE', relayStatus: 'OFF', recordedAt: new Date().toISOString() }
  ]
};

function getLocalDemoData(path) {
  if (path === '/sensor-data/latest') {
    return demoDb.readings[demoDb.readings.length - 1];
  }
  if (path === '/sensor-data/trend') {
    return demoDb.readings.slice(-50);
  }
  if (path === '/sensor-data/stats') {
    const total = demoDb.readings.length;
    const safeCount = demoDb.readings.filter(r => r.status === 'SAFE').length;
    const avg = key => demoDb.readings.reduce((sum, r) => sum + r[key], 0) / (total || 1);
    return {
      totalReadings: total,
      safeReadingsCount: safeCount,
      unsafeReadingsCount: total - safeCount,
      safePercentage: Math.round(((safeCount / (total || 1)) * 100) * 100) / 100,
      avgPh: Math.round(avg('phValue') * 100) / 100,
      avgTds: Math.round(avg('tdsValue') * 10) / 10,
      avgTurbidity: Math.round(avg('turbidityValue') * 100) / 100,
      avgTemperature: Math.round(avg('temperatureValue') * 10) / 10
    };
  }
  if (path.startsWith('/sensor-data/history')) {
    const sorted = [...demoDb.readings].reverse();
    return {
      content: sorted.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE),
      totalElements: demoDb.readings.length,
      totalPages: Math.ceil(demoDb.readings.length / HISTORY_PAGE_SIZE) || 1,
      number: historyPage,
      first: historyPage === 0,
      last: historyPage >= Math.ceil(demoDb.readings.length / HISTORY_PAGE_SIZE) - 1
    };
  }
  return null;
}

function ingestLocalReading(dto) {
  const isSafe = (dto.phValue >= THRESHOLDS.ph.min && dto.phValue <= THRESHOLDS.ph.max) &&
                 (dto.tdsValue >= THRESHOLDS.tds.min && dto.tdsValue <= THRESHOLDS.tds.max) &&
                 (dto.turbidityValue <= THRESHOLDS.turbidity.max) &&
                 (dto.temperatureValue >= THRESHOLDS.temperature.min && dto.temperatureValue <= THRESHOLDS.temperature.max);

  const status = isSafe ? 'SAFE' : 'UNSAFE';
  const relayStatus = isSafe ? 'OFF' : 'ON';

  const newRecord = {
    id: demoDb.readings.length + 1,
    deviceId: dto.deviceId || 'ESP32-01',
    phValue: dto.phValue,
    tdsValue: dto.tdsValue,
    turbidityValue: dto.turbidityValue,
    temperatureValue: dto.temperatureValue,
    status: status,
    relayStatus: relayStatus,
    recordedAt: new Date().toISOString()
  };

  demoDb.readings.push(newRecord);
  return newRecord;
}

// ---------------------- DASHBOARD RENDERING ----------------------
function setConnectionState(mode) {
  if (!connIndicator || !connText) return;
  connIndicator.classList.remove('online', 'simulation', 'offline');

  if (mode === 'live') {
    connIndicator.classList.add('online');
    connText.textContent = 'ONLINE (REST)';
  } else if (mode === 'demo') {
    connIndicator.classList.add('simulation');
    connText.textContent = 'SIMULATION';
  } else {
    connIndicator.classList.add('offline');
    connText.textContent = 'OFFLINE';
  }
}

function renderGaugeCard(idPrefix, value, threshold) {
  const valEl = document.getElementById(`${idPrefix}Value`);
  const fillEl = document.getElementById(`${idPrefix}Fill`);
  const badgeEl = document.getElementById(`${idPrefix}Badge`);
  const trendEl = document.getElementById(`${idPrefix}Trend`);
  const cardEl = document.getElementById(`card-${idPrefix}`);

  if (!valEl || !fillEl) return;

  if (value == null) {
    valEl.textContent = '--';
    fillEl.style.width = '0%';
    return;
  }

  valEl.textContent = Number(value).toFixed(idPrefix === 'tds' ? 1 : 2);

  const pct = Math.min(100, Math.max(3, (value / threshold.absMax) * 100));
  fillEl.style.width = `${pct}%`;

  const isSafe = idPrefix === 'turbidity'
    ? value <= threshold.max
    : (value >= threshold.min && value <= threshold.max);

  fillEl.classList.toggle('unsafe', !isSafe);
  if (cardEl) cardEl.dataset.state = isSafe ? 'safe' : 'unsafe';

  if (badgeEl) {
    if (isSafe) {
      badgeEl.textContent = 'SAFE';
      badgeEl.className = 'metric-badge';
    } else {
      badgeEl.textContent = 'EXCEEDED';
      badgeEl.className = 'metric-badge unsafe';
    }
  }

  // Trend calculation vs last reading
  if (trendEl && lastKnownReading) {
    const prevVal = lastKnownReading[`${idPrefix}Value`];
    if (prevVal != null) {
      const diff = value - prevVal;
      if (Math.abs(diff) >= 0.05) {
        trendEl.textContent = diff > 0 ? `↑ +${diff.toFixed(1)}` : `↓ ${diff.toFixed(1)}`;
        trendEl.className = `metric-trend ${diff > 0 ? 'up' : 'down'}`;
      } else {
        trendEl.textContent = '• stable';
        trendEl.className = 'metric-trend';
      }
    }
  }
}

function addAlertEntry(type, message) {
  const timeStr = new Date().toLocaleTimeString();
  activeAlerts.unshift({ time: timeStr, type, message });
  if (activeAlerts.length > 20) activeAlerts.pop();

  if (alertFeedList) {
    alertFeedList.innerHTML = activeAlerts.map(a => `
      <div class="alert-item ${a.type}">
        <span class="alert-time">${a.time}</span>
        <span class="alert-msg">${a.message}</span>
      </div>
    `).join('');
  }
}

function renderLatestReading(latest) {
  if (!latest) return;

  if (deviceIdLabel && latest.deviceId) {
    deviceIdLabel.textContent = latest.deviceId;
  }

  renderGaugeCard('ph', latest.phValue, THRESHOLDS.ph);
  renderGaugeCard('tds', latest.tdsValue, THRESHOLDS.tds);
  renderGaugeCard('turbidity', latest.turbidityValue, THRESHOLDS.turbidity);
  renderGaugeCard('temperature', latest.temperatureValue, THRESHOLDS.temperature);

  // WQI calculation
  const wqi = calculateWQI(latest.phValue, latest.tdsValue, latest.turbidityValue, latest.temperatureValue);
  updateWQIMeter(wqi);

  // Banner status
  const isSafe = latest.status === 'SAFE';
  if (statusBanner) {
    statusBanner.dataset.state = isSafe ? 'safe' : 'unsafe';
  }
  if (statusWord) {
    statusWord.textContent = isSafe ? 'WATER IS SAFE' : 'UNSAFE WATER DETECTED';
  }
  if (statusRemarks) {
    statusRemarks.textContent = latest.remarks || (isSafe
      ? 'All physical and chemical parameters adhere to WHO drinking water benchmarks.'
      : 'Hazard threshold breached: Automated purification system energized.');
  }

  // Relay status
  const relayOn = latest.relayStatus === 'ON';
  if (relayIndicator) {
    relayIndicator.dataset.relay = relayOn ? 'on' : 'off';
  }
  if (relayText) {
    relayText.textContent = relayOn ? 'ACTIVE (ON)' : 'STANDBY (OFF)';
  }
  if (relayCaption) {
    relayCaption.textContent = relayOn
      ? '⚡ Purification Relay Energized (System Active)'
      : 'Water Safe — Actuator Standing By';
  }

  // Audio & Alert triggers
  if (!lastKnownReading || lastKnownReading.status !== latest.status) {
    if (!isSafe) {
      sfx.playAlarm();
      showToast('⚠️ Water Contamination Detected! Relay ON', 'unsafe');
      addAlertEntry('critical', `Contamination event detected on ${latest.deviceId}: pH=${latest.phValue}, Turbidity=${latest.turbidityValue} NTU.`);
    } else if (lastKnownReading && lastKnownReading.status === 'UNSAFE') {
      sfx.playSafeChime();
      showToast('✓ Water quality restored to safe benchmarks. Relay OFF', 'safe');
      addAlertEntry('resolved', `Water quality stabilized to safe ranges.`);
    }
  }

  lastKnownReading = latest;

  if (lastUpdatedEl && latest.recordedAt) {
    lastUpdatedEl.textContent = `Last reading: ${new Date(latest.recordedAt).toLocaleTimeString()}`;
  }
}

function renderStatsStrip(stats) {
  if (!stats) return;
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('statTotal', stats.totalReadings ?? 0);
  setEl('statSafePct', `${stats.safePercentage ?? 0}%`);
  setEl('statAvgPh', stats.avgPh != null ? stats.avgPh.toFixed(2) : '--');
  setEl('statAvgTds', stats.avgTds != null ? stats.avgTds.toFixed(1) : '--');
  setEl('statAvgTurbidity', stats.avgTurbidity != null ? stats.avgTurbidity.toFixed(2) : '--');
  setEl('statAvgTemp', stats.avgTemperature != null ? stats.avgTemperature.toFixed(1) : '--');
}

// ---------------------- TREND CHART ENGINE ----------------------
function renderTrendChart(readings) {
  if (!readings || readings.length === 0) return;
  const canvas = document.getElementById('trendChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const sliced = readings.slice(-currentChartLimit);
  const labels = sliced.map(r => new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  const allDatasets = [
    {
      id: 'ph',
      label: 'pH Level',
      data: sliced.map(r => r.phValue),
      borderColor: '#00f2fe',
      backgroundColor: 'rgba(0, 242, 254, 0.1)',
      borderWidth: 2.2,
      tension: 0.35,
      yAxisID: 'yPh',
      pointRadius: 2.5
    },
    {
      id: 'tds',
      label: 'TDS (ppm)',
      data: sliced.map(r => r.tdsValue),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245, 158, 11, 0.08)',
      borderWidth: 2,
      tension: 0.35,
      yAxisID: 'yTds',
      pointRadius: 2.5
    },
    {
      id: 'turbidity',
      label: 'Turbidity (NTU)',
      data: sliced.map(r => r.turbidityValue),
      borderColor: '#f87171',
      backgroundColor: 'rgba(248, 113, 113, 0.1)',
      borderWidth: 2,
      tension: 0.35,
      yAxisID: 'yTurb',
      pointRadius: 2.5
    },
    {
      id: 'temp',
      label: 'Temp (°C)',
      data: sliced.map(r => r.temperatureValue),
      borderColor: '#38bdf8',
      backgroundColor: 'rgba(56, 189, 248, 0.08)',
      borderWidth: 1.8,
      tension: 0.35,
      yAxisID: 'yTemp',
      pointRadius: 2
    }
  ];

  const filteredDatasets = currentChartFilter === 'all'
    ? allDatasets
    : allDatasets.filter(d => d.id === currentChartFilter);

  const config = {
    type: 'line',
    data: { labels, datasets: filteredDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 400 },
      plugins: {
        legend: {
          labels: {
            color: '#cbd5e1',
            font: { family: 'Plus Jakarta Sans', size: 12, weight: 600 },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(10, 27, 36, 0.95)',
          titleFont: { family: 'JetBrains Mono', size: 12 },
          bodyFont: { family: 'Plus Jakarta Sans', size: 12 },
          borderColor: 'rgba(0, 242, 254, 0.3)',
          borderWidth: 1,
          padding: 12,
          displayColors: true
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { family: 'JetBrains Mono', size: 10 } },
          grid: { color: 'rgba(40, 85, 105, 0.25)' }
        },
        yPh: {
          type: 'linear',
          display: currentChartFilter === 'all' || currentChartFilter === 'ph',
          position: 'left',
          min: 4,
          max: 10,
          ticks: { color: '#00f2fe', font: { size: 10 } },
          grid: { color: 'rgba(40, 85, 105, 0.25)' }
        },
        yTds: {
          type: 'linear',
          display: currentChartFilter === 'all' || currentChartFilter === 'tds',
          position: 'right',
          ticks: { color: '#f59e0b', font: { size: 10 } },
          grid: { drawOnChartArea: false }
        },
        yTurb: {
          type: 'linear',
          display: currentChartFilter === 'turbidity',
          position: 'left',
          ticks: { color: '#f87171', font: { size: 10 } }
        },
        yTemp: {
          type: 'linear',
          display: currentChartFilter === 'temp',
          position: 'right',
          ticks: { color: '#38bdf8', font: { size: 10 } }
        }
      }
    }
  };

  if (trendChart) {
    trendChart.data = config.data;
    trendChart.options = config.options;
    trendChart.update();
  } else {
    trendChart = new Chart(canvas.getContext('2d'), config);
  }
}

// ---------------------- HISTORY TABLE & EXPORT ----------------------
function renderHistoryTable(page) {
  const tbody = document.getElementById('historyBody');
  if (!tbody) return;

  const rows = (page && page.content) || [];
  rawHistoryData = rows;

  const searchQuery = (tableSearchInput?.value || '').toLowerCase().trim();
  const statusFilter = statusFilterSelect?.value || 'ALL';

  const filtered = rows.filter(r => {
    const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
    const matchQuery = !searchQuery ||
      r.deviceId.toLowerCase().includes(searchQuery) ||
      new Date(r.recordedAt).toLocaleString().toLowerCase().includes(searchQuery) ||
      String(r.phValue).includes(searchQuery);
    return matchStatus && matchQuery;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No matching sensor records found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const wqi = calculateWQI(r.phValue, r.tdsValue, r.turbidityValue, r.temperatureValue);
    return `
      <tr>
        <td>${new Date(r.recordedAt).toLocaleString()}</td>
        <td><strong style="color: ${r.phValue < 6.5 || r.phValue > 8.5 ? 'var(--danger)' : '#fff'}">${r.phValue.toFixed(2)}</strong></td>
        <td><strong style="color: ${r.tdsValue > 500 ? 'var(--danger)' : '#fff'}">${r.tdsValue.toFixed(1)}</strong></td>
        <td><strong style="color: ${r.turbidityValue > 5 ? 'var(--danger)' : '#fff'}">${r.turbidityValue.toFixed(2)}</strong></td>
        <td>${r.temperatureValue.toFixed(1)}</td>
        <td><span class="status-pill ${r.status === 'SAFE' ? 'safe' : 'unsafe'}">${r.status}</span></td>
        <td><span class="relay-pill ${r.relayStatus === 'ON' ? 'on' : ''}">${r.relayStatus}</span></td>
        <td><span style="color: ${wqi.color}; font-weight:700;">WQI: ${wqi.score}</span></td>
      </tr>
    `;
  }).join('');

  historyTotalPages = (page && page.totalPages) || 1;
  const pageIndicator = document.getElementById('pageIndicator');
  if (pageIndicator) pageIndicator.textContent = `Page ${(page ? page.number : 0) + 1} of ${historyTotalPages}`;

  const historyRange = document.getElementById('historyRange');
  if (historyRange) historyRange.textContent = `${(page && page.totalElements) || filtered.length} archived readings`;

  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  if (prevBtn) prevBtn.disabled = Boolean(page && page.first);
  if (nextBtn) nextBtn.disabled = Boolean(page && page.last);
}

// Export CSV
function exportDataToCsv() {
  if (rawHistoryData.length === 0) {
    showToast('No records available to export', 'info');
    return;
  }
  const headers = ['Timestamp', 'Device ID', 'pH Level', 'TDS (ppm)', 'Turbidity (NTU)', 'Temperature (C)', 'Status', 'Relay Status'];
  const rows = rawHistoryData.map(r => [
    `"${new Date(r.recordedAt).toISOString()}"`,
    `"${r.deviceId}"`,
    r.phValue,
    r.tdsValue,
    r.turbidityValue,
    r.temperatureValue,
    `"${r.status}"`,
    `"${r.relayStatus}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `aquawatch_telemetry_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('✓ CSV file downloaded', 'safe');
}

// Export JSON
function exportDataToJson() {
  if (rawHistoryData.length === 0) {
    showToast('No records available to export', 'info');
    return;
  }
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rawHistoryData, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `aquawatch_data_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('✓ JSON file downloaded', 'safe');
}

// ---------------------- HARDWARE TELEMETRY SIMULATION ----------------------
async function injectReading(type = 'safe') {
  let sample;
  if (type === 'safe') {
    sample = {
      deviceId: 'ESP32-01',
      phValue: +(6.9 + Math.random() * 0.8).toFixed(2),
      tdsValue: +(180 + Math.random() * 120).toFixed(1),
      turbidityValue: +(1.0 + Math.random() * 2.2).toFixed(2),
      temperatureValue: +(23.0 + Math.random() * 3.0).toFixed(1)
    };
    showToast('Injected Safe Water Telemetry', 'safe');
  } else {
    // Contamination spike
    sample = {
      deviceId: 'ESP32-01',
      phValue: +(5.2 + Math.random() * 0.7).toFixed(2), // Acidic
      tdsValue: +(560 + Math.random() * 180).toFixed(1), // High TDS
      turbidityValue: +(6.5 + Math.random() * 5.0).toFixed(2), // High Turbidity
      temperatureValue: +(27.5 + Math.random() * 4.0).toFixed(1)
    };
    showToast('⚡ Injected Contamination Spike! Alert Activated', 'unsafe');
  }

  await apiPost('/sensor-data', sample);
  await refreshDashboard();
  await loadHistory();
}

function toggleAutoSimulation() {
  if (autoSimTimer) {
    clearInterval(autoSimTimer);
    autoSimTimer = null;
    simAutoToggleBtn.classList.remove('active');
    simAutoText.textContent = 'Start Auto-Stream (5s)';
    showToast('Auto-telemetry simulation paused', 'info');
  } else {
    let count = 0;
    autoSimTimer = setInterval(() => {
      count++;
      // Every 4th reading is an unsafe anomaly
      injectReading(count % 4 === 0 ? 'spike' : 'safe');
    }, 5000);
    simAutoToggleBtn.classList.add('active');
    simAutoText.textContent = 'Streaming Live Telemetry (5s)';
    showToast('Auto-telemetry streaming started', 'safe');
  }
}

// ---------------------- MAIN DATA CYCLE ----------------------
async function refreshDashboard() {
  if (refreshSpinner) refreshSpinner.classList.add('spinning');
  try {
    const [latest, stats, trend] = await Promise.all([
      apiGet('/sensor-data/latest').catch(() => null),
      apiGet('/sensor-data/stats').catch(() => null),
      apiGet('/sensor-data/trend').catch(() => [])
    ]);

    renderLatestReading(latest);
    renderStatsStrip(stats);
    renderTrendChart(trend || []);
    setConnectionState(isDemoMode ? 'demo' : 'live');
  } catch (err) {
    console.error('Refresh cycle error:', err);
    setConnectionState('offline');
  } finally {
    if (refreshSpinner) {
      setTimeout(() => refreshSpinner.classList.remove('spinning'), 500);
    }
  }
}

async function loadHistory() {
  try {
    const page = await apiGet(`/sensor-data/history?page=${historyPage}&size=${HISTORY_PAGE_SIZE}`);
    renderHistoryTable(page);
  } catch (err) {
    console.error('History load error:', err);
  }
}

// ---------------------- EVENT LISTENERS & SETUP ----------------------
function setupEventListeners() {
  // Simulator Toolbar Toggle
  if (toggleSimBarBtn) {
    toggleSimBarBtn.addEventListener('click', () => {
      isSimulatorOpen = !isSimulatorOpen;
      simulatorToolbar.classList.toggle('collapsed', !isSimulatorOpen);
    });
  }

  // Audio Toggle
  if (soundToggleBtn) {
    soundToggleBtn.addEventListener('click', () => {
      isAudioEnabled = !isAudioEnabled;
      soundIconOn.classList.toggle('hidden', !isAudioEnabled);
      soundIconOff.classList.toggle('hidden', isAudioEnabled);
      soundText.textContent = isAudioEnabled ? 'Audio: ON' : 'Audio: MUTE';
      showToast(isAudioEnabled ? 'Alarm audio enabled' : 'Alarm audio muted', 'info');
    });
  }

  // Manual Refresh
  if (manualRefreshBtn) {
    manualRefreshBtn.addEventListener('click', async () => {
      await refreshDashboard();
      await loadHistory();
      showToast('Dashboard refreshed', 'info');
    });
  }

  // Poll Interval
  if (pollIntervalSelect) {
    pollIntervalSelect.addEventListener('change', (e) => {
      pollIntervalMs = parseInt(e.target.value, 10);
      if (pollTimer) clearInterval(pollTimer);
      if (pollIntervalMs > 0) {
        pollTimer = setInterval(refreshDashboard, pollIntervalMs);
        showToast(`Auto-polling set to ${pollIntervalMs / 1000}s`, 'info');
      } else {
        showToast('Auto-polling paused (Manual refresh mode)', 'info');
      }
    });
  }

  // Simulation Buttons
  if (simSafeBtn) simSafeBtn.addEventListener('click', () => injectReading('safe'));
  if (simSpikeBtn) simSpikeBtn.addEventListener('click', () => injectReading('spike'));
  if (simAutoToggleBtn) simAutoToggleBtn.addEventListener('click', toggleAutoSimulation);
  if (simResetBtn) {
    simResetBtn.addEventListener('click', () => {
      demoDb.readings = demoDb.readings.slice(0, 6);
      activeAlerts = [];
      refreshDashboard();
      loadHistory();
      showToast('Telemetry stream reset to defaults', 'info');
    });
  }

  // Manual Relay Override Toggle
  if (manualRelayToggleBtn) {
    manualRelayToggleBtn.addEventListener('click', () => {
      const current = relayIndicator.dataset.relay === 'on';
      const newState = !current;
      relayIndicator.dataset.relay = newState ? 'on' : 'off';
      relayText.textContent = newState ? 'MANUAL OVERRIDE (ON)' : 'STANDBY (OFF)';
      relayCaption.textContent = newState ? 'Actuator manually engaged for test' : 'Actuator standing by';
      if (newState) sfx.playAlarm();
      showToast(`Relay actuator manually set to ${newState ? 'ON' : 'OFF'}`, newState ? 'unsafe' : 'safe');
    });
  }

  // Chart Filters
  document.querySelectorAll('.chart-filter-pills .pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-filter-pills .pill').forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      currentChartFilter = e.target.dataset.filter;
      refreshDashboard();
    });
  });

  // Chart Point Limit
  document.querySelectorAll('.chart-point-selector .limit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.chart-point-selector .limit-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentChartLimit = parseInt(e.target.dataset.limit, 10);
      refreshDashboard();
    });
  });

  // Table Filters & Search
  if (tableSearchInput) {
    tableSearchInput.addEventListener('input', () => renderHistoryTable({ content: rawHistoryData, totalPages: historyTotalPages, number: historyPage }));
  }
  if (statusFilterSelect) {
    statusFilterSelect.addEventListener('change', () => renderHistoryTable({ content: rawHistoryData, totalPages: historyTotalPages, number: historyPage }));
  }

  // Export Buttons
  if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportDataToCsv);
  if (exportJsonBtn) exportJsonBtn.addEventListener('click', exportDataToJson);

  // Clear Alerts
  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener('click', () => {
      activeAlerts = [];
      if (alertFeedList) {
        alertFeedList.innerHTML = `
          <div class="empty-alert-msg">
            <span>Alert log cleared. Monitoring active streams...</span>
          </div>
        `;
      }
      showToast('Incident log cleared', 'info');
    });
  }

  // Pagination
  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (historyPage > 0) {
      historyPage--;
      loadHistory();
    }
  });
  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (historyPage < historyTotalPages - 1) {
      historyPage++;
      loadHistory();
    }
  });
}

// ---------------------- INITIALIZATION ----------------------
async function init() {
  setupEventListeners();
  await refreshDashboard();
  await loadHistory();
  pollTimer = setInterval(refreshDashboard, pollIntervalMs);
  setInterval(loadHistory, pollIntervalMs);
}

// Start application
init();
