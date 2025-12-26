/**
 * Home Automation Frontend
 */

let config = {};
let definitions = [];
let devices = [];
let currentDevice = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadDefinitions();
  await loadDevices();
  setupEventListeners();

  // Refresh every 5 seconds
  setInterval(loadDevices, 5000);
});

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
    const isSynced = JSON.stringify(spec) === JSON.stringify(status);
    const syncClass = Object.keys(status).length > 0 ? (isSynced ? 'synced' : 'out-of-sync') : '';

    return `
      <div class="device-card ${syncClass}" onclick="openDeviceControl('${device.metadata?.name}')">
        <div class="device-header">
          <span class="device-name">${device.metadata?.name || 'Unnamed'}</span>
          <span class="device-kind">${device.kind || 'Unknown'}</span>
        </div>
        <div class="device-room">${spec.room || 'No room assigned'}</div>
        <div class="device-state-preview">
          ${renderStatePreview(spec, status)}
        </div>
      </div>
    `;
  }).join('');
}

function renderStatePreview(spec, status) {
  const items = [];

  if ('power' in spec) {
    const isOn = status.power ?? spec.power;
    items.push(`
      <div class="state-item">
        <span class="state-indicator ${isOn ? 'on' : 'off'}"></span>
        <span>${isOn ? 'On' : 'Off'}</span>
      </div>
    `);
  }

  if ('brightness' in spec) {
    items.push(`
      <div class="state-item">
        <span>${status.brightness ?? spec.brightness}%</span>
      </div>
    `);
  }

  if ('temperature' in spec) {
    items.push(`
      <div class="state-item">
        <span>${status.temperature ?? spec.temperature}C</span>
      </div>
    `);
  }

  return items.join('');
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
  // Add device button
  document.getElementById('add-device-btn').addEventListener('click', () => {
    openModal('add-device-modal');
  });

  // Add definition button
  document.getElementById('add-definition-btn').addEventListener('click', () => {
    openModal('add-definition-modal');
  });

  // Add device form
  document.getElementById('add-device-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDevice();
  });

  // Add definition form
  document.getElementById('add-definition-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addDefinition();
  });

  // Reconcile button
  document.getElementById('reconcile-btn').addEventListener('click', async () => {
    if (currentDevice) {
      await reconcileDevice(currentDevice);
    }
  });

  // Delete device button
  document.getElementById('delete-device-btn').addEventListener('click', async () => {
    if (currentDevice && confirm(`Delete device "${currentDevice}"?`)) {
      await deleteDevice(currentDevice);
    }
  });

  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });
}

async function addDevice() {
  const name = document.getElementById('device-name').value;
  const kind = document.getElementById('device-kind').value;
  const room = document.getElementById('device-room').value;

  try {
    const spec = { room };

    // Add default properties based on kind
    if (kind.toLowerCase().includes('light')) {
      spec.power = false;
      spec.brightness = 100;
    } else if (kind.toLowerCase().includes('thermostat')) {
      spec.power = true;
      spec.temperature = 21;
    } else {
      spec.power = false;
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

    document.getElementById('control-device-name').textContent = name;
    renderDeviceControls(device);
    renderDeviceStatus(device);
    openModal('device-control-modal');
  } catch (error) {
    showNotification('Failed to load device', 'error');
  }
}

function renderDeviceControls(device) {
  const container = document.getElementById('device-controls');
  const spec = device.spec || {};
  const controls = [];

  // Power toggle
  if ('power' in spec) {
    controls.push(`
      <div class="control-group">
        <span class="control-label">Power</span>
        <div class="control-value">
          <div class="toggle ${spec.power ? 'active' : ''}" onclick="updateSpec('${device.metadata.name}', 'power', ${!spec.power})"></div>
        </div>
      </div>
    `);
  }

  // Brightness slider
  if ('brightness' in spec) {
    controls.push(`
      <div class="control-group">
        <span class="control-label">Brightness</span>
        <div class="control-value">
          <div class="slider-container">
            <input type="range" class="slider" min="0" max="100" value="${spec.brightness}"
              onchange="updateSpec('${device.metadata.name}', 'brightness', parseInt(this.value))">
            <span class="slider-value">${spec.brightness}%</span>
          </div>
        </div>
      </div>
    `);
  }

  // Temperature slider
  if ('temperature' in spec) {
    controls.push(`
      <div class="control-group">
        <span class="control-label">Temperature</span>
        <div class="control-value">
          <div class="slider-container">
            <input type="range" class="slider" min="15" max="30" value="${spec.temperature}"
              onchange="updateSpec('${device.metadata.name}', 'temperature', parseInt(this.value))">
            <span class="slider-value">${spec.temperature}C</span>
          </div>
        </div>
      </div>
    `);
  }

  // Room (editable)
  controls.push(`
    <div class="control-group">
      <span class="control-label">Room</span>
      <div class="control-value">
        <input type="text" value="${spec.room || ''}" placeholder="Enter room name"
          onchange="updateSpec('${device.metadata.name}', 'room', this.value)"
          style="background: #1a1a2e; border: 1px solid #374151; padding: 0.5rem; border-radius: 4px; color: #eee;">
      </div>
    </div>
  `);

  container.innerHTML = controls.join('');
}

function renderDeviceStatus(device) {
  const status = device.status || {};
  const statusEl = document.getElementById('device-status');

  if (Object.keys(status).length === 0) {
    statusEl.textContent = 'No status reported yet.\nRun a reconciler to update device status.';
  } else {
    statusEl.textContent = JSON.stringify(status, null, 2);
  }
}

async function updateSpec(name, key, value) {
  try {
    await fetch(`/api/devices/${name}/spec`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });

    // Refresh the control panel
    await openDeviceControl(name);
    await loadDevices();
  } catch (error) {
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
