/**
 * =============================================================================
 * FloodGuard AI 2.0 — Pi Hardware Bridge Frontend Client
 * =============================================================================
 * Receives real-time GNSS GPS and LoRa sensor pole telemetry from the local
 * Raspberry Pi Python bridge (http://localhost:8088/api/stream).
 * 
 * Provides seamless fallbacks to browser geolocation if running standalone.
 * =============================================================================
 */

class PiHardwareBridge {
  constructor(bridgeUrl = 'http://127.0.0.1:8088') {
    this.bridgeUrl = bridgeUrl;
    this.eventSource = null;
    this.isConnected = false;
    this.gpsListeners = [];
    this.loraListeners = [];
    this.statusListeners = [];
    this.lastGPS = null;
    this.lastLoRa = {};

    this.connect();
  }

  connect() {
    try {
      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource(`${this.bridgeUrl}/api/stream`);

      this.eventSource.addEventListener('init', (e) => {
        try {
          const state = JSON.parse(e.data);
          this.isConnected = true;
          this.lastGPS = state.gps;
          this.lastLoRa = state.lora_poles;
          this.notifyStatus({ connected: true, system: state.system });
          if (state.gps) this.notifyGPS(state.gps);
          if (state.lora_poles) this.notifyLoRa(state.lora_poles, true);
        } catch (err) {
          console.error('[PiBridge] Error parsing init packet:', err);
        }
      });

      this.eventSource.addEventListener('gps', (e) => {
        try {
          const gps = JSON.parse(e.data);
          this.lastGPS = gps;
          this.notifyGPS(gps);
        } catch (err) {
          console.error('[PiBridge] GPS parse error:', err);
        }
      });

      this.eventSource.addEventListener('lora', (e) => {
        try {
          const node = JSON.parse(e.data);
          this.lastLoRa[node.id] = node;
          this.notifyLoRa(node, false);
        } catch (err) {
          console.error('[PiBridge] LoRa node parse error:', err);
        }
      });

      this.eventSource.addEventListener('lora_all', (e) => {
        try {
          const nodes = JSON.parse(e.data);
          this.lastLoRa = nodes;
          this.notifyLoRa(nodes, true);
        } catch (err) {
          console.error('[PiBridge] LoRa all parse error:', err);
        }
      });

      this.eventSource.addEventListener('status', (e) => {
        try {
          const sys = JSON.parse(e.data);
          this.notifyStatus({ connected: true, system: sys });
        } catch (err) {
          console.error('[PiBridge] Status parse error:', err);
        }
      });

      this.eventSource.onerror = () => {
        if (this.isConnected) {
          this.isConnected = false;
          this.notifyStatus({ connected: false, message: 'Reconnecting to Pi Bridge...' });
        }
        // Auto-reconnect managed by EventSource
      };

    } catch (err) {
      console.warn('[PiBridge] Local hardware bridge not reachable. Running in standalone fallback mode.', err);
      this.notifyStatus({ connected: false, fallback: true });
    }
  }

  onGPS(callback) {
    if (typeof callback === 'function') {
      this.gpsListeners.push(callback);
      if (this.lastGPS) callback(this.lastGPS);
    }
  }

  onLoRa(callback) {
    if (typeof callback === 'function') {
      this.loraListeners.push(callback);
      if (Object.keys(this.lastLoRa).length > 0) callback(this.lastLoRa, true);
    }
  }

  onStatus(callback) {
    if (typeof callback === 'function') {
      this.statusListeners.push(callback);
      callback({ connected: this.isConnected });
    }
  }

  notifyGPS(gpsData) {
    this.gpsListeners.forEach(cb => {
      try { cb(gpsData); } catch (e) { console.error(e); }
    });
  }

  notifyLoRa(loraData, isBatch = false) {
    this.loraListeners.forEach(cb => {
      try { cb(loraData, isBatch); } catch (e) { console.error(e); }
    });
  }

  notifyStatus(statusData) {
    this.statusListeners.forEach(cb => {
      try { cb(statusData); } catch (e) { console.error(e); }
    });
  }

  updateLiveLocation(lat, lng, accuracy = 10, heading = 0, speed = 0, alt = null) {
    if (lat === null || lat === undefined || lng === null || lng === undefined) return;
    try {
      fetch(`${this.bridgeUrl}/api/gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: Number(lat),
          lng: Number(lng),
          accuracy: Number(accuracy || 10),
          heading_deg: Number(heading || 0),
          speed_kmh: Number(speed || 0),
          altitude_m: alt !== null ? Number(alt) : null
        })
      }).catch(() => {});
    } catch (_) {}
  }

  clearLocation() {
    this.lastGPS = {
      lat: null,
      lng: null,
      fix_quality: "NOT_CONNECTED",
      source: "NOT_CONNECTED",
      satellites: 0,
      speed_kmh: 0,
      heading_deg: 0
    };
    try {
      fetch(`${this.bridgeUrl}/api/gps/clear`, { method: 'POST' }).catch(() => {});
    } catch (_) {}
    this.notifyGPS(this.lastGPS);
  }

  /**
   * Directly hooks into Leaflet map and updates the rescue vehicle's position,
   * heading rotation, speed display, and elevation HUD.
   */
  attachRescueVehicleTracker(map, onVehicleMove) {
    if (!map) return;

    // Tactical 3D Chevron Directional Arrow Icon
    const chevronIcon = L.divIcon({
      className: 'rescue-convoy-chevron-container',
      html: `
        <div id="convoyHeadingArrow" style="
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: rgba(14, 165, 233, 0.95);
          border: 2px solid #ffffff;
          box-shadow: 0 0 20px rgba(14, 165, 233, 0.8), 0 4px 12px rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.25s ease-out;
        ">
          <span style="
            color: #ffffff;
            font-size: 1.25rem;
            line-height: 1;
            font-weight: 900;
            display: inline-block;
            transform: translateY(-1px);
          ">▲</span>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    let marker = null;
    let accuracyCircle = null;

    this.onGPS((gps) => {
      if (!gps || gps.lat === null || gps.lat === undefined || gps.lng === null || gps.lng === undefined) {
        return;
      }
      if (typeof gps.source === 'string' && gps.source.toUpperCase().includes('SIMULATION')) {
        return; // Discard any simulation data
      }

      const lat = gps.lat;
      const lng = gps.lng;
      const heading = gps.heading_deg || 0;
      const speed = gps.speed_kmh || 0;
      const alt = gps.altitude_m || 512;

      if (!marker) {
        marker = L.marker([lat, lng], {
          icon: chevronIcon,
          zIndexOffset: 1500
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family:Inter,sans-serif;padding:6px;min-width:180px;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#0ea5e9;margin-bottom:4px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>
              🚑 Tactical Rescue Convoy
            </div>
            <div style="font-size:0.80rem;color:#cbd5e1;">Hardware GPS fix active (${gps.source || 'GNSS'})</div>
            <div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">
              Speed: <strong>${speed} km/h</strong> · Heading: <strong>${heading}&deg;</strong>
            </div>
          </div>
        `);
      } else {
        marker.setLatLng([lat, lng]);
      }

      // Rotate arrow to true heading
      const arrowEl = document.getElementById('convoyHeadingArrow');
      if (arrowEl) {
        arrowEl.style.transform = `rotate(${heading}deg)`;
      }

      // Update in-drive dock / speedometer if elements exist
      const speedEl = document.getElementById('convoySpeedDisplay');
      if (speedEl) speedEl.textContent = `${Math.round(speed)} km/h`;

      const altEl = document.getElementById('convoyAltDisplay');
      if (altEl) altEl.textContent = `${Math.round(alt)} m`;

      if (typeof onVehicleMove === 'function') {
        onVehicleMove(gps);
      }
    });

    return {
      getMarker: () => marker,
      recenter: () => {
        if (marker && this.lastGPS) {
          map.flyTo([this.lastGPS.lat, this.lastGPS.lng], 16, { animate: true, duration: 1.0 });
        }
      }
    };
  }

  /**
   * Syncs live LoRa area cards on lora-data.html
   */
  attachLoRaDashboardSync() {
    this.onLoRa((data, isBatch) => {
      const grid = document.getElementById('nodesGrid');
      if (!grid) return;

      const noMsg = document.getElementById('noLoraMessage');
      const nodesList = isBatch ? Object.values(data) : [data];
      
      let discoveredCount = 0;
      let alertCount = 0;

      nodesList.forEach((node) => {
        // Only render if pole has transmitted real data
        if (!node || node.water_level === null || node.water_level === undefined) {
          return;
        }

        discoveredCount++;
        if (noMsg) noMsg.style.display = 'none';

        let card = document.getElementById(`card-${node.id}`);
        if (!card) {
          card = document.createElement('div');
          card.className = 'node-card';
          card.id = `card-${node.id}`;
          grid.appendChild(card);
        }

        const isSurge = node.status && (node.status.includes('CRITICAL') || node.status.includes('SURGE'));
        const isWarn = node.status && node.status.includes('WARN');
        if (isSurge || isWarn) alertCount++;

        const statusClass = isSurge ? 'status-critical' : (isWarn ? 'status-warning' : 'status-normal');
        const sign = (node.hourly_rise_rate && node.hourly_rise_rate > 0) ? '+' : '';
        const icon = isSurge ? '🚨' : (isWarn ? '⚠️' : '📍');
        const displayName = node.name || node.id;
        const gpsStr = (node.lat && node.lng) ? `GPS: ${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}` : 'GPS: Local Sector';

        card.innerHTML = `
          <div class="node-header">
            <span class="node-name"><span>${icon}</span> ${displayName}</span>
            <span class="node-status-pill ${statusClass}">${(node.status || 'ONLINE').replace(/_/g, ' ')}</span>
          </div>
          <div class="node-stats">
            <div class="node-stat-item">
              <span>Water Level</span>
              <strong style="${isSurge ? 'color:#f87171;' : ''}">${Number(node.water_level).toFixed(2)} m</strong>
            </div>
            <div class="node-stat-item">
              <span>Surge Rate</span>
              <strong style="${isSurge ? 'color:#f87171;' : ''}">${sign}${Number(node.hourly_rise_rate || 0).toFixed(2)} m/h</strong>
            </div>
            <div class="node-stat-item">
              <span>Battery</span>
              <strong>${node.battery_v ? Number(node.battery_v).toFixed(2) + ' V' : '--'}</strong>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.75rem;color:#64748b;">${gpsStr}</span>
            <button class="btn-ai-query" onclick="consultAIForNodeId('${node.id}', '${displayName}')">
              <span>🤖</span>
              <span>AI Query</span>
            </button>
          </div>
        `;
      });

      // Update KPI counters dynamically
      const kpiTotal = document.getElementById('kpiTotalNodes');
      const kpiActive = document.getElementById('kpiActiveNodes');
      const kpiAlerts = document.getElementById('kpiAlertTally');

      if (kpiTotal) kpiTotal.textContent = `${discoveredCount} Discovered`;
      if (kpiActive) kpiActive.textContent = `${discoveredCount} Transmitting`;
      if (kpiAlerts) {
        if (discoveredCount === 0) {
          kpiAlerts.textContent = 'Listening on LoRa...';
        } else {
          kpiAlerts.textContent = `${alertCount} Alerts · ${discoveredCount - alertCount} Normal`;
        }
      }
    });
  }
}

// Global Export
export const piBridge = new PiHardwareBridge();
window.piBridge = piBridge;
