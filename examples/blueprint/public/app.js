/**
 * Home Automation Frontend
 * Visualizes device state from ColonyOS blueprints
 * - spec = desired state (what user wants)
 * - status = actual state (reported by reconciler)
 */

let config = {};
let definitions = [];
let devices = [];
let currentDevice = null;
let currentDeviceData = null;
let ws = null;
const pendingUpdates = new Map(); // Track pending spec updates for timing

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadDefinitions();
  await loadDevices();
  setupEventListeners();
  connectWebSocket();
});

// WebSocket connection to reconciler for real-time device state updates
function connectWebSocket() {
  // Connect to reconciler WebSocket (default port 3001)
  const wsPort = 3001;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.hostname}:${wsPort}`;

  console.log('Connecting to reconciler WebSocket at:', wsUrl);

  try {
    ws = new WebSocket(wsUrl);
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    return;
  }

  ws.onopen = () => {
    console.log('Connected to reconciler WebSocket');
    document.getElementById('connection-status').textContent =
      `Connected to ${config.colonyName} @ ${config.serverHost}:${config.serverPort} (live)`;
    document.getElementById('connection-status').classList.add('connected');
  };

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    console.log('WebSocket message received:', message);

    if (message.type === 'init') {
      // Initial state from reconciler
      console.log('Received initial device states:', Object.keys(message.devices));
      updateDevicesFromReconciler(message.devices);
    } else if (message.type === 'update') {
      // Single device update
      console.log(`Device update: ${message.device}`, message.status);
      updateSingleDeviceStatus(message.device, message.status);
    }
  };

  ws.onclose = (event) => {
    console.log('Reconciler WebSocket closed. Code:', event.code, 'Reason:', event.reason, 'Clean:', event.wasClean);
    document.getElementById('connection-status').textContent = 'Reconnecting to reconciler...';
    document.getElementById('connection-status').classList.remove('connected');
    setTimeout(connectWebSocket, 2000);
  };

  ws.onerror = (event) => {
    console.error('Reconciler WebSocket error - connection to port 3001 failed. Is the reconciler running?');
  };
}

// Update device statuses from reconciler's in-memory state
function updateDevicesFromReconciler(reconcilerStates) {
  for (const [name, status] of Object.entries(reconcilerStates)) {
    updateSingleDeviceStatus(name, status);
  }
}

// Update a single device's status and re-render
function updateSingleDeviceStatus(deviceName, status) {
  const receiveTime = performance.now();

  // Check if we have a pending update to measure round-trip time
  const pending = pendingUpdates.get(deviceName);
  if (pending) {
    const roundTrip = receiveTime - pending.startTime;
    console.log(`[${receiveTime.toFixed(0)}ms] UI: Received status update for ${deviceName} (round-trip: ${roundTrip.toFixed(0)}ms)`, status);
    showNotification(`Synced in ${roundTrip.toFixed(0)}ms`, 'success');
    pendingUpdates.delete(deviceName);
  } else {
    console.log(`[${receiveTime.toFixed(0)}ms] UI: Received status update for ${deviceName}`, status);
  }

  const device = devices.find(d => d.metadata?.name === deviceName);
  if (device) {
    console.log(`Setting ${deviceName} status:`, status);
    device.status = status;
    renderDevices();

    // Update modal if this device is open
    if (currentDevice === deviceName) {
      console.log(`Updating modal for ${deviceName}`);
      currentDeviceData = device;
      renderDeviceVisualization(device);
      renderActualState(device);
    }
  } else {
    console.log(`Device ${deviceName} not found in devices array`);
  }
}

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    config = await res.json();
    document.getElementById('connection-status').textContent =
      `Connected to ${config.colonyName} @ ${config.serverHost}:${config.serverPort}`;
    document.getElementById('connection-status').classList.add('connected');
  } catch (error) {
    document.getElementById('connection-status').textContent = 'Connection failed';
    showNotification('Failed to connect to server', 'error');
  }
}

async function loadDefinitions() {
  try {
    const res = await fetch('/api/definitions');
    definitions = await res.json();
    renderDefinitions();
    updateDeviceKindOptions();
  } catch (error) {
    showNotification('Failed to load device types', 'error');
  }
}

async function loadDevices() {
  try {
    const res = await fetch('/api/devices');
    devices = await res.json();
    renderDevices();

    // Update modal if open
    if (currentDevice) {
      const device = devices.find(d => d.metadata?.name === currentDevice);
      if (device) {
        currentDeviceData = device;
        renderDeviceVisualization(device);
        renderActualState(device);
      }
    }
  } catch (error) {
    console.error('Failed to load devices:', error);
  }
}

function renderDefinitions() {
  const container = document.getElementById('definitions-list');

  if (!definitions || definitions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No device types defined</p>
      </div>
    `;
    return;
  }

  container.innerHTML = definitions.map(def => `
    <div class="definition-tag">
      <span class="kind">${def.kind || def.spec?.names?.kind || 'Unknown'}</span>
      <span>${def.metadata?.name || ''}</span>
      <button class="delete-btn" onclick="deleteDefinition('${def.metadata?.name}')">&times;</button>
    </div>
  `).join('');
}

function renderDevices() {
  const container = document.getElementById('devices-grid');

  if (!devices || devices.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No devices configured</p>
        <button class="btn btn-primary" onclick="openModal('add-device-modal')">Add Your First Device</button>
      </div>
    `;
    return;
  }

  container.innerHTML = devices.map(device => {
    const spec = device.spec || {};
    const status = device.status || {};
    const hasStatus = Object.keys(status).length > 0;
    const isSynced = hasStatus && isStateSynced(spec, status);
    const syncClass = hasStatus ? (isSynced ? 'synced' : 'out-of-sync') : 'no-status';
    const deviceType = spec.deviceType || 'light';

    return `
      <div class="device-card ${syncClass}" onclick="openDeviceControl('${device.metadata?.name}')">
        <div class="device-header">
          <span class="device-name">${device.metadata?.name || 'Unnamed'}</span>
          <span class="sync-badge ${syncClass}">${getSyncLabel(syncClass)}</span>
        </div>
        <div class="device-room">${spec.room || 'No room'}</div>

        <div class="device-visual">
          ${renderDeviceCard(deviceType, spec, status, hasStatus)}
        </div>

        <div class="device-states">
          <div class="state-row">
            <span class="state-label">Desired:</span>
            <span class="state-value">${formatStateValue(spec)}</span>
          </div>
          <div class="state-row">
            <span class="state-label">Actual:</span>
            <span class="state-value ${hasStatus ? '' : 'no-data'}">${hasStatus ? formatStateValue(status) : 'Waiting for reconciler...'}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function isStateSynced(spec, status) {
  // Compare relevant fields only (ignore metadata like lastUpdated)
  const specPower = spec.power;
  const statusPower = status.power;
  const specBrightness = spec.brightness;
  const statusBrightness = status.brightness;
  const specTemperature = spec.temperature;
  const statusTemperature = status.temperature;

  if ('power' in spec && specPower !== statusPower) return false;
  if ('brightness' in spec && specBrightness !== statusBrightness) return false;
  if ('temperature' in spec && specTemperature !== statusTemperature) return false;

  return true;
}

function getSyncLabel(syncClass) {
  switch (syncClass) {
    case 'synced': return 'Synced';
    case 'out-of-sync': return 'Pending';
    case 'no-status': return 'No Status';
    default: return '';
  }
}

function formatStateValue(state) {
  const parts = [];
  if ('power' in state) parts.push(state.power ? 'On' : 'Off');
  if ('brightness' in state) parts.push(`${state.brightness}%`);
  if ('temperature' in state) parts.push(`${state.temperature}C`);
  return parts.join(', ') || 'N/A';
}

function renderDeviceCard(deviceType, spec, status, hasStatus) {
  if (deviceType === 'thermostat') {
    return renderThermostatCard(spec, status, hasStatus);
  }
  return renderLightCard(spec, status, hasStatus);
}

function renderLightCard(spec, status, hasStatus) {
  const desiredOn = spec.power === true;
  const actualOn = hasStatus ? status.power === true : null;
  const desiredBrightness = spec.brightness || 100;
  const actualBrightness = hasStatus ? (status.brightness || 0) : null;

  // Show actual state if available, otherwise show desired
  const displayOn = hasStatus ? actualOn : desiredOn;
  const displayBrightness = hasStatus ? actualBrightness : desiredBrightness;

  const glowIntensity = displayOn ? (displayBrightness / 100) : 0;
  const bulbColor = displayOn ? `rgba(255, 220, 100, ${0.5 + glowIntensity * 0.5})` : '#444';
  const glowSize = displayOn ? Math.floor(10 + glowIntensity * 20) : 0;

  return `
    <div class="light-visual">
      <svg viewBox="0 0 100 120" class="light-bulb">
        <!-- Glow effect -->
        ${displayOn ? `
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="${glowSize}" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
        ` : ''}

        <!-- Bulb -->
        <ellipse cx="50" cy="45" rx="35" ry="40"
          fill="${bulbColor}"
          ${displayOn ? 'filter="url(#glow)"' : ''}
          stroke="#666" stroke-width="2"/>

        <!-- Filament lines when on -->
        ${displayOn ? `
          <path d="M35 40 Q50 55 65 40" stroke="rgba(255,200,50,0.8)" stroke-width="2" fill="none"/>
          <path d="M40 50 Q50 60 60 50" stroke="rgba(255,200,50,0.6)" stroke-width="1.5" fill="none"/>
        ` : ''}

        <!-- Base -->
        <rect x="35" y="85" width="30" height="8" fill="#888" rx="2"/>
        <rect x="38" y="93" width="24" height="5" fill="#666" rx="1"/>
        <rect x="40" y="98" width="20" height="5" fill="#555" rx="1"/>
        <rect x="42" y="103" width="16" height="8" fill="#444" rx="2"/>
      </svg>
      <div class="light-info">
        <span class="power-state ${displayOn ? 'on' : 'off'}">${displayOn ? 'ON' : 'OFF'}</span>
        ${displayBrightness !== null ? `<span class="brightness">${displayBrightness}%</span>` : ''}
      </div>
    </div>
  `;
}

function renderThermostatCard(spec, status, hasStatus) {
  const desiredTemp = spec.temperature || 20;
  const actualTemp = hasStatus ? (status.temperature || null) : null;
  const displayTemp = hasStatus && actualTemp !== null ? actualTemp : desiredTemp;
  const isOn = hasStatus ? status.power : spec.power;

  // Temperature color gradient (blue cold to red hot)
  const tempPercent = Math.max(0, Math.min(100, ((displayTemp - 15) / 15) * 100));
  const hue = 240 - (tempPercent * 2.4); // 240 (blue) to 0 (red)

  return `
    <div class="thermostat-visual">
      <div class="thermostat-dial" style="--temp-hue: ${hue}">
        <div class="dial-ring ${isOn ? 'active' : ''}">
          <div class="dial-inner">
            <span class="temp-value">${displayTemp}</span>
            <span class="temp-unit">C</span>
          </div>
        </div>
        <div class="dial-indicator" style="transform: rotate(${(tempPercent * 2.7) - 135}deg)"></div>
      </div>
      <div class="thermostat-info">
        <span class="power-state ${isOn ? 'on' : 'off'}">${isOn ? 'HEATING' : 'OFF'}</span>
      </div>
    </div>
  `;
}

function updateDeviceKindOptions() {
  const select = document.getElementById('device-kind');
  select.innerHTML = '<option value="">Select device type...</option>';

  if (definitions && definitions.length > 0) {
    definitions.forEach(def => {
      const kind = def.kind || def.spec?.names?.kind;
      if (kind) {
        select.innerHTML += `<option value="${kind}">${kind}</option>`;
      }
    });
  }
}

function setupEventListeners() {
  document.getElementById('add-device-btn').addEventListener('click', () => {
    openModal('add-device-modal');
  });

  document.getElementById('add-definition-btn').addEventListener('click', () => {
    openModal('add-definition-modal');
  });

  document.getElementById('add-device-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDevice();
  });

  document.getElementById('add-definition-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDefinition();
  });

  document.getElementById('reconcile-btn').addEventListener('click', async () => {
    if (currentDevice) {
      await reconcileDevice(currentDevice);
    }
  });

  document.getElementById('delete-device-btn').addEventListener('click', async () => {
    if (currentDevice && confirm(`Delete device "${currentDevice}"?`)) {
      await deleteDevice(currentDevice);
    }
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        currentDevice = null;
        currentDeviceData = null;
      }
    });
  });
}

async function addDevice() {
  const name = document.getElementById('device-name').value;
  const kind = document.getElementById('device-kind').value;
  const deviceType = document.getElementById('device-type').value;
  const room = document.getElementById('device-room').value;

  try {
    const spec = { room, deviceType };

    if (deviceType === 'light') {
      spec.power = false;
      spec.brightness = 100;
    } else if (deviceType === 'thermostat') {
      spec.power = true;
      spec.temperature = 21;
    }

    await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind, spec }),
    });

    closeModal('add-device-modal');
    document.getElementById('add-device-form').reset();
    await loadDevices();
    showNotification(`Device "${name}" created`, 'success');
  } catch (error) {
    showNotification('Failed to create device', 'error');
  }
}

async function addDefinition() {
  const name = document.getElementById('def-name').value;
  const kind = document.getElementById('def-kind').value;

  try {
    await fetch('/api/definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind }),
    });

    closeModal('add-definition-modal');
    document.getElementById('add-definition-form').reset();
    await loadDefinitions();
    showNotification(`Device type "${kind}" created`, 'success');
  } catch (error) {
    showNotification('Failed to create device type', 'error');
  }
}

async function deleteDefinition(name) {
  if (!confirm(`Delete device type "${name}"?`)) return;

  try {
    await fetch(`/api/definitions/${name}`, { method: 'DELETE' });
    await loadDefinitions();
    showNotification('Device type deleted', 'success');
  } catch (error) {
    showNotification('Failed to delete device type', 'error');
  }
}

async function deleteDevice(name) {
  try {
    await fetch(`/api/devices/${name}`, { method: 'DELETE' });
    closeModal('device-control-modal');
    currentDevice = null;
    currentDeviceData = null;
    await loadDevices();
    showNotification('Device deleted', 'success');
  } catch (error) {
    showNotification('Failed to delete device', 'error');
  }
}

async function openDeviceControl(name) {
  currentDevice = name;

  try {
    const res = await fetch(`/api/devices/${name}`);
    const device = await res.json();
    currentDeviceData = device;

    document.getElementById('control-device-name').textContent = `${name} (${device.spec?.room || 'No room'})`;
    renderDeviceVisualization(device);
    renderDesiredStateControls(device);
    renderActualState(device);
    openModal('device-control-modal');
  } catch (error) {
    showNotification('Failed to load device', 'error');
  }
}

function renderDeviceVisualization(device) {
  const container = document.getElementById('device-visualization');
  const spec = device.spec || {};
  const status = device.status || {};
  const hasStatus = Object.keys(status).length > 0;
  const deviceType = spec.deviceType || 'light';

  if (deviceType === 'thermostat') {
    container.innerHTML = renderThermostatVisualization(spec, status, hasStatus);
  } else {
    container.innerHTML = renderLightVisualization(spec, status, hasStatus);
  }
}

function renderLightVisualization(spec, status, hasStatus) {
  const desiredOn = spec.power === true;
  const actualOn = hasStatus ? status.power === true : null;
  const desiredBrightness = spec.brightness || 100;
  const actualBrightness = hasStatus ? status.brightness : null;

  return `
    <div class="visual-comparison">
      <div class="visual-side desired-visual">
        <h5>Desired</h5>
        ${renderLargeLightBulb(desiredOn, desiredBrightness, 'desired')}
      </div>
      <div class="visual-arrow">${hasStatus ? (isStateSynced(spec, status) ? '=' : '&ne;') : '?'}</div>
      <div class="visual-side actual-visual">
        <h5>Actual</h5>
        ${hasStatus
          ? renderLargeLightBulb(actualOn, actualBrightness, 'actual')
          : '<div class="no-status-visual">Waiting for reconciler...</div>'
        }
      </div>
    </div>
  `;
}

function renderLargeLightBulb(isOn, brightness, type) {
  const glowIntensity = isOn ? (brightness / 100) : 0;
  const bulbColor = isOn ? `rgba(255, 220, 100, ${0.5 + glowIntensity * 0.5})` : '#444';
  const glowSize = isOn ? Math.floor(5 + glowIntensity * 15) : 0;

  return `
    <svg viewBox="0 0 100 130" class="large-light-bulb">
      ${isOn ? `
        <defs>
          <filter id="glow-${type}" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="${glowSize}" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      ` : ''}

      <ellipse cx="50" cy="50" rx="40" ry="45"
        fill="${bulbColor}"
        ${isOn ? `filter="url(#glow-${type})"` : ''}
        stroke="#666" stroke-width="2"/>

      ${isOn ? `
        <path d="M30 45 Q50 65 70 45" stroke="rgba(255,200,50,0.8)" stroke-width="3" fill="none"/>
        <path d="M35 55 Q50 70 65 55" stroke="rgba(255,200,50,0.6)" stroke-width="2" fill="none"/>
      ` : ''}

      <rect x="35" y="95" width="30" height="8" fill="#888" rx="2"/>
      <rect x="38" y="103" width="24" height="5" fill="#666" rx="1"/>
      <rect x="40" y="108" width="20" height="5" fill="#555" rx="1"/>
      <rect x="42" y="113" width="16" height="10" fill="#444" rx="2"/>
    </svg>
    <div class="visual-label">
      <span class="${isOn ? 'on' : 'off'}">${isOn ? 'ON' : 'OFF'}</span>
      <span>${brightness}%</span>
    </div>
  `;
}

function renderThermostatVisualization(spec, status, hasStatus) {
  const desiredTemp = spec.temperature || 20;
  const actualTemp = hasStatus ? status.temperature : null;

  return `
    <div class="visual-comparison thermostat-comparison">
      <div class="visual-side desired-visual">
        <h5>Desired</h5>
        ${renderLargeThermostat(desiredTemp, spec.power, 'desired')}
      </div>
      <div class="visual-arrow">${hasStatus ? (isStateSynced(spec, status) ? '=' : '&ne;') : '?'}</div>
      <div class="visual-side actual-visual">
        <h5>Actual</h5>
        ${hasStatus
          ? renderLargeThermostat(actualTemp, status.power, 'actual')
          : '<div class="no-status-visual">Waiting for reconciler...</div>'
        }
      </div>
    </div>
  `;
}

function renderLargeThermostat(temp, isOn, type) {
  const tempPercent = Math.max(0, Math.min(100, ((temp - 15) / 15) * 100));
  const hue = 240 - (tempPercent * 2.4);

  return `
    <div class="large-thermostat" style="--temp-hue: ${hue}">
      <div class="large-dial ${isOn ? 'active' : ''}">
        <div class="large-dial-inner">
          <span class="large-temp">${temp}</span>
          <span class="large-temp-unit">C</span>
        </div>
      </div>
    </div>
    <div class="visual-label">
      <span class="${isOn ? 'on' : 'off'}">${isOn ? 'HEATING' : 'OFF'}</span>
    </div>
  `;
}

function renderDesiredStateControls(device) {
  const container = document.getElementById('desired-state-controls');
  const spec = device.spec || {};
  const controls = [];

  if ('power' in spec) {
    controls.push(`
      <div class="control-item">
        <span class="control-label">Power</span>
        <div class="toggle ${spec.power ? 'active' : ''}" onclick="updateSpec('${device.metadata.name}', 'power', ${!spec.power})"></div>
      </div>
    `);
  }

  if ('brightness' in spec) {
    controls.push(`
      <div class="control-item">
        <span class="control-label">Brightness</span>
        <div class="slider-group">
          <input type="range" class="slider" min="0" max="100" value="${spec.brightness}"
            onchange="updateSpec('${device.metadata.name}', 'brightness', parseInt(this.value))">
          <span class="slider-value">${spec.brightness}%</span>
        </div>
      </div>
    `);
  }

  if ('temperature' in spec) {
    controls.push(`
      <div class="control-item">
        <span class="control-label">Temperature</span>
        <div class="slider-group">
          <input type="range" class="slider" min="15" max="30" value="${spec.temperature}"
            onchange="updateSpec('${device.metadata.name}', 'temperature', parseInt(this.value))">
          <span class="slider-value">${spec.temperature}C</span>
        </div>
      </div>
    `);
  }

  container.innerHTML = controls.join('');
}

function renderActualState(device) {
  const container = document.getElementById('actual-state-display');
  const status = device.status || {};

  if (Object.keys(status).length === 0) {
    container.innerHTML = `
      <div class="no-status-message">
        <p>No status reported yet.</p>
        <p class="hint">Start the reconciler to update device status.</p>
      </div>
    `;
    return;
  }

  const items = [];
  if ('power' in status) {
    items.push(`
      <div class="status-item">
        <span class="status-label">Power</span>
        <span class="status-value ${status.power ? 'on' : 'off'}">${status.power ? 'ON' : 'OFF'}</span>
      </div>
    `);
  }
  if ('brightness' in status) {
    items.push(`
      <div class="status-item">
        <span class="status-label">Brightness</span>
        <span class="status-value">${status.brightness}%</span>
      </div>
    `);
  }
  if ('temperature' in status) {
    items.push(`
      <div class="status-item">
        <span class="status-label">Temperature</span>
        <span class="status-value">${status.temperature}C</span>
      </div>
    `);
  }
  if ('online' in status) {
    items.push(`
      <div class="status-item">
        <span class="status-label">Online</span>
        <span class="status-value ${status.online ? 'on' : 'off'}">${status.online ? 'Yes' : 'No'}</span>
      </div>
    `);
  }
  if ('lastUpdated' in status) {
    const time = new Date(status.lastUpdated).toLocaleTimeString();
    items.push(`
      <div class="status-item">
        <span class="status-label">Last Updated</span>
        <span class="status-value">${time}</span>
      </div>
    `);
  }

  container.innerHTML = items.join('');
}

async function updateSpec(name, key, value) {
  const startTime = performance.now();
  console.log(`[${startTime.toFixed(0)}ms] UI: Sending spec update for ${name}.${key} = ${value}`);

  // Track this update for timing when we receive the WebSocket response
  pendingUpdates.set(name, { startTime, key, value });

  try {
    await fetch(`/api/devices/${name}/spec`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });

    const apiTime = performance.now();
    console.log(`[${apiTime.toFixed(0)}ms] UI: API call completed (${(apiTime - startTime).toFixed(0)}ms)`);

    // Update local spec immediately for responsive UI
    const device = devices.find(d => d.metadata?.name === name);
    if (device) {
      device.spec = { ...device.spec, [key]: value };
      if (currentDevice === name) {
        currentDeviceData = device;
        renderDesiredStateControls(device);
        renderDeviceVisualization(device);
      }
      renderDevices();
    }
    // Don't call loadDevices() - it races with WebSocket status updates
  } catch (error) {
    pendingUpdates.delete(name);
    showNotification('Failed to update device', 'error');
  }
}

async function reconcileDevice(name) {
  try {
    await fetch(`/api/devices/${name}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force: false }),
    });
    showNotification('Reconciliation triggered', 'success');
  } catch (error) {
    showNotification('Failed to trigger reconciliation', 'error');
  }
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
  if (id === 'device-control-modal') {
    currentDevice = null;
    currentDeviceData = null;
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}
