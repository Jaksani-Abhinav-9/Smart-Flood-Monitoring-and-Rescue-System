import { aiEngine } from './ai-engine.js';

const g = typeof window !== 'undefined' ? window : globalThis;

// ── GLOBAL BUTTON HANDLERS ──────────────────────────────────────────────────

g.openProfile = function () {
  if (typeof window !== 'undefined') window.location.href = 'profile.html';
};

g.openAIChat = function () {
  const overlay = document.getElementById('aiChatOverlay');
  if (overlay) {
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  }
  const input = document.getElementById('aiInput');
  if (input) input.focus();
};

g.closeAIChat = function () {
  const overlay = document.getElementById('aiChatOverlay');
  if (overlay) {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }
};

g.goToSuggestion = function () {
  g.openAIChat();
};

g.closeSuggestion = function () {
  g.closeAIChat();
};

g.openAlerts = function () {
  renderAlerts();
  const overlay = document.getElementById('alertsOverlay');
  if (overlay) overlay.classList.add('show');
};

g.closeAlerts = function () {
  const overlay = document.getElementById('alertsOverlay');
  if (overlay) overlay.classList.remove('show');
};

g.clearAIChat = function () {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return;
  msgs.innerHTML = `
    <div class="ai-bubble ai">
      <div class="ai-bubble-head">
        <span class="ai-bubble-name">FloodGuard AI</span>
        <span class="ai-bubble-time">Just now</span>
      </div>
      <div class="ai-bubble-body">👋 Chat cleared. I am ready to answer any flood emergency, vehicle escape, battery conservation, or survival questions.</div>
    </div>
  `;
};

g.askQuickPrompt = function (query) {
  const input = document.getElementById('aiInput');
  if (!input) return;
  input.value = query;
  g.sendAIMessage();
};

g.copyAIText = function (btn) {
  const bubbleBody = btn.previousElementSibling;
  if (!bubbleBody) return;
  const text = bubbleBody.textContent || '';
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
  }).catch(() => {});
};

g.appendMessage = function (text, role) {
  const msgs = document.getElementById('aiMessages');
  if (!msgs) return;

  const bubble = document.createElement('div');
  bubble.className = `ai-bubble ${role}`;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (role === 'user') {
    bubble.innerHTML = `
      <div class="ai-bubble-body">${escapeHTML(text)}</div>
    `;
  } else {
    bubble.innerHTML = `
      <div class="ai-bubble-head">
        <span class="ai-bubble-name">FloodGuard AI</span>
        <span class="ai-bubble-time">${timeStr}</span>
      </div>
      <div class="ai-bubble-body">${escapeHTML(text)}</div>
      <button class="ai-copy-btn" type="button" onclick="copyAIText(this)">📋 Copy Directive</button>
    `;
  }

  msgs.appendChild(bubble);
  msgs.scrollTop = msgs.scrollHeight;
};

function escapeHTML(str) {
  const p = document.createElement('p');
  p.textContent = str;
  return p.innerHTML;
}

g.sendAIMessage = async function () {
  const input = document.getElementById('aiInput');
  if (!input) return;
  const question = input.value.trim();
  if (!question) return;
  input.value = '';

  g.appendMessage(question, 'user');

  // Typing indicator
  const msgs = document.getElementById('aiMessages');
  const indicator = document.createElement('div');
  indicator.id = 'aiTypingIndicator';
  indicator.className = 'ai-typing-indicator';
  indicator.innerHTML = `
    <span>AI analyzing emergency</span>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  if (msgs) {
    msgs.appendChild(indicator);
    msgs.scrollTop = msgs.scrollHeight;
  }

  try {
    const answer = await aiEngine.generateCitizenResponse(question);
    if (indicator && indicator.parentNode) indicator.remove();
    g.appendMessage(answer || 'No emergency response generated. In danger, call 112 immediately.', 'ai');
  } catch (err) {
    if (indicator && indicator.parentNode) indicator.remove();
    g.appendMessage(`⚠️ AI Directive Notice: ${err.message || String(err)}`, 'ai');
  }
};

g.shareLocation = function () {
  if (!navigator.geolocation) {
    g.showToast?.('Location sharing is not available');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const link = `https://www.google.com/maps/search/?api=1&query=${pos.coords.latitude},${pos.coords.longitude}`;
      navigator.clipboard.writeText(link).then(() => {
        g.showToast?.('Location link copied for family sharing');
      });
    },
    () => {
      g.showToast?.('Unable to retrieve location for sharing');
    },
    { enableHighAccuracy: true }
  );
};

g.showToast = function (message) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2700);
};

// ── DOM & MAP DATA INITIALIZATION ───────────────────────────────────────────

let alertsData = [];

const resourceLocations = [
  { title: 'Relief Camp', coords: [18.3213, 78.2981], type: 'camp', eta: 6 },
  { title: 'Hyderabad Medical Center', coords: [18.3345, 78.3092], type: 'hospital', eta: 9 },
  { title: 'Police Station', coords: [18.3286, 78.3154], type: 'police', eta: 7 }
];

const riskZones = [
  { name: 'High Risk', color: '#f87171', coords: [[18.3237, 78.3001], [18.3248, 78.3121], [18.3182, 78.3168], [18.3127, 78.3072]], opacity: 0.22 },
  { name: 'Moderate Risk', color: '#fb923c', coords: [[18.3287, 78.2842], [18.3341, 78.2958], [18.3269, 78.2975], [18.3217, 78.2877]], opacity: 0.18 }
];

let map = null;
let currentPosition = { lat: 18.3221, lng: 78.3033 };
let sosHoldTimer = null;
let holdSeconds = 3;
let userLiveMarker = null;
let userAccuracyCircle = null;
let watchId = null;
let hasCenteredUser = false;
let activeSosDocId = null;

function setupLiveLocationTracking() {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser.');
    return;
  }

  const userLiveIcon = L.divIcon({
    className: 'user-live-beacon-container',
    html: `
      <div class="user-live-beacon">
        <div class="user-live-pulse"></div>
        <div class="user-live-core"></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  function onLocationUpdate(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy || 20;

    currentPosition = { lat, lng };
    localStorage.setItem('userLat', lat);
    localStorage.setItem('userLng', lng);

    if (map) {
      if (!userLiveMarker) {
        userLiveMarker = L.marker([lat, lng], {
          icon: userLiveIcon,
          zIndexOffset: 1000
        }).addTo(map);

        userLiveMarker.bindPopup(`
          <div style="font-family:Inter,sans-serif;padding:4px;">
            <div style="display:flex;align-items:center;gap:6px;font-weight:700;color:#2563eb;margin-bottom:4px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 6px #10b981;"></span>
              Live GPS Location
            </div>
            <div style="font-size:0.82rem;color:#475569;">Continuous tracking active for flood rescue operations.</div>
            <div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">Accuracy: &plusmn;${Math.round(accuracy)}m</div>
          </div>
        `);

        userAccuracyCircle = L.circle([lat, lng], {
          radius: accuracy,
          color: '#3b82f6',
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          weight: 1.5
        }).addTo(map);

        if (!hasCenteredUser) {
          map.flyTo([lat, lng], 15, { animate: true, duration: 1.2 });
          hasCenteredUser = true;
        }
      } else {
        userLiveMarker.setLatLng([lat, lng]);
        if (userAccuracyCircle) {
          userAccuracyCircle.setLatLng([lat, lng]);
          userAccuracyCircle.setRadius(accuracy);
        }
      }
    }

    // Continuous update to active SOS ticket in Firestore for real-time rescue tracking
    if (activeSosDocId && window.firebaseDb && window.firebaseFirestoreModule) {
      try {
        const { doc, updateDoc, serverTimestamp } = window.firebaseFirestoreModule;
        if (doc && updateDoc) {
          updateDoc(doc(window.firebaseDb, 'sos', activeSosDocId), {
            lat: lat,
            lng: lng,
            location: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
            lastLiveUpdate: serverTimestamp ? serverTimestamp() : new Date().toISOString()
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Real-time SOS position update note:', err);
      }
    }

    // Continuous sync to user's profile document if authenticated
    try {
      const user = window.firebaseAuth?.currentUser;
      if (user && window.firebaseDb && window.firebaseFirestoreModule) {
        const { doc, setDoc, serverTimestamp } = window.firebaseFirestoreModule;
        if (doc && setDoc) {
          setDoc(doc(window.firebaseDb, 'users', user.uid), {
            liveLat: lat,
            liveLng: lng,
            lastSeen: serverTimestamp ? serverTimestamp() : new Date().toISOString()
          }, { merge: true }).catch(() => {});
        }
      }
    } catch (_) {}
  }

  function onLocationError(err) {
    console.warn('Continuous GPS tracking note:', err.message);
  }

  watchId = navigator.geolocation.watchPosition(onLocationUpdate, onLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  });

  const recenterBtn = document.getElementById('recenterBtn');
  if (recenterBtn) {
    recenterBtn.addEventListener('click', () => {
      if (map && currentPosition) {
        map.flyTo([currentPosition.lat, currentPosition.lng], 16, { animate: true, duration: 1.2 });
        if (userLiveMarker) {
          userLiveMarker.openPopup();
        }
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initPage() {
  // 1. Initialize Leaflet Map defensively with Satellite Hybrid & Labels
  const mapEl = document.getElementById('map');
  if (mapEl && typeof L !== 'undefined') {
    try {
      const googleHybrid = L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        maxZoom: 21,
        maxNativeZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      });

      const esriSatLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 17
      });
      const esriLabelLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        maxNativeZoom: 17
      });
      const esriHybrid = L.layerGroup([esriSatLayer, esriLabelLayer]);

      const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      });

      map = L.map('map', {
        center: [18.3221, 78.3033],
        zoom: 14,
        layers: [googleHybrid],
        attributionControl: false
      });

      const baseLayers = {
        "🛰️ Ultra HD Satellite (Clear)": googleHybrid,
        "🛰️ Esri Satellite (Hybrid)": esriHybrid,
        "🗺️ Standard Street Map": streetLayer
      };
      L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

      // Point / Click Anywhere for Detailed Location Info Popup
      const inspectPopup = L.popup({ maxWidth: 320 });
      map.on('click', async (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        inspectPopup.setLatLng(e.latlng).setContent(`
          <div style="font-family:Inter,system-ui,sans-serif;padding:6px;min-width:180px;">
            <div style="font-size:0.75rem;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;">
              📍 Identifying Location...
            </div>
            <div style="font-size:0.80rem;color:#cbd5e1;">Querying area details...</div>
            <div style="font-size:0.72rem;color:#64748b;margin-top:4px;">GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
          </div>
        `).openOn(map);

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
          let placeName = 'Location Point';
          let addressText = 'Telangana, India';

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            placeName = data.name || addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || 'Kamareddy Area';
            const district = addr.county || addr.state_district || addr.district || 'Kamareddy';
            const state = addr.state || 'Telangana';
            const road = addr.road ? `${addr.road}, ` : '';
            addressText = `${road}${placeName}, ${district}, ${state}`;
          }

          inspectPopup.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:8px;color:#f8fafc;background:#0f172a;border-radius:12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:0.72rem;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.06em;">📍 Location Intel</span>
                <span style="font-size:0.70rem;background:rgba(56,189,248,0.15);color:#38bdf8;padding:2px 6px;border-radius:999px;">Telangana</span>
              </div>
              <div style="font-size:0.95rem;font-weight:700;color:#ffffff;line-height:1.3;margin-bottom:4px;">
                ${escapeHtml(placeName)}
              </div>
              <div style="font-size:0.80rem;color:#94a3b8;line-height:1.4;margin-bottom:8px;">
                ${escapeHtml(addressText)}
              </div>
              <div style="background:rgba(255,255,255,0.06);padding:6px 8px;border-radius:8px;font-size:0.75rem;font-family:monospace;color:#e2e8f0;display:flex;justify-content:space-between;align-items:center;">
                <span>GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}</span>
                <button onclick="navigator.clipboard.writeText('${lat.toFixed(5)}, ${lng.toFixed(5)}');this.innerText='Copied!';" style="background:#2563eb;color:white;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:0.7rem;font-weight:600;">Copy</button>
              </div>
            </div>
          `);
        } catch (_) {
          inspectPopup.setContent(`
            <div style="font-family:Inter,system-ui,sans-serif;padding:6px;color:#f8fafc;background:#0f172a;border-radius:8px;">
              <div style="font-size:0.75rem;font-weight:700;color:#38bdf8;margin-bottom:2px;">📍 Location Intel</div>
              <div style="font-size:0.85rem;color:#e2e8f0;">Kamareddy Area, Telangana</div>
              <div style="font-size:0.75rem;color:#94a3b8;margin-top:4px;">GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
            </div>
          `);
        }
      });

      // Start continuous live GPS tracking and render live user beacon
      setupLiveLocationTracking();
    } catch (e) {
      console.warn('Map initialization note:', e);
    }
  }

  // 2. Bind DOM Event Listeners defensively
  const suggestionBtn = document.getElementById('suggestionOpenBtn');
  if (suggestionBtn) suggestionBtn.addEventListener('click', window.openAIChat);

  // Immediately warm up and start fine-tuned FloodGuard Citizen AI on app launch
  aiEngine.init((status) => {
    console.log('[FloodGuard AI Auto-Start]', status);
  });

  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.addEventListener('click', window.sendAIMessage);

  const aiInput = document.getElementById('aiInput');
  if (aiInput) {
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.sendAIMessage();
      }
    });
  }

  const aiCloseBtn = document.getElementById('aiCloseBtn');
  if (aiCloseBtn) aiCloseBtn.addEventListener('click', window.closeAIChat);

  const aiOverlay = document.getElementById('aiChatOverlay');
  if (aiOverlay) {
    aiOverlay.addEventListener('click', (e) => {
      if (e.target === aiOverlay) window.closeAIChat();
    });
  }

  const alertsBtn = document.getElementById('alertsOpenBtn');
  if (alertsBtn) alertsBtn.addEventListener('click', window.openAlerts);

  const alertsClose = document.getElementById('alertsCloseBtn');
  if (alertsClose) alertsClose.addEventListener('click', window.closeAlerts);

  const alertsOverlay = document.getElementById('alertsOverlay');
  if (alertsOverlay) {
    alertsOverlay.addEventListener('click', (e) => {
      if (e.target === alertsOverlay) window.closeAlerts();
    });
  }

  // SOS Hold Actions
  const sosBtn = document.getElementById('sosActionBtn');
  const sosBtnMobile = document.getElementById('sosActionBtnMobile');

  [sosBtn, sosBtnMobile].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener('pointerdown', startSOSHold);
    btn.addEventListener('pointerup', cancelSOSHold);
    btn.addEventListener('pointerleave', cancelSOSHold);
    btn.addEventListener('pointercancel', cancelSOSHold);
    btn.addEventListener('touchend', cancelSOSHold);
    btn.addEventListener('touchcancel', cancelSOSHold);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  const confirmCancel = document.getElementById('confirmCancelBtn');
  if (confirmCancel) confirmCancel.addEventListener('click', cancelSOSHold);

  // 3. Realtime Cloud Alerts from Firebase Firestore
  setupRealtimeAlertsListener();

  // 4. Auto-initialize AI engine status
  try {
    aiEngine.init((status) => {
      console.log('[FloodGuard AI]', status);
    });
  } catch (e) {
    console.warn('AI Engine init note:', e);
  }
}

let isSOSSending = false;
let isSOSActive = false;

function startSOSHold(e) {
  if (isSOSSending || isSOSActive) return;
  if (sosHoldTimer) clearInterval(sosHoldTimer);

  holdSeconds = 3;
  const sosBtn = document.getElementById('sosActionBtn');
  const sosBtnMobile = document.getElementById('sosActionBtnMobile');
  const sosText = document.querySelector('#sosActionBtn span:last-child');

  [sosBtn, sosBtnMobile].forEach((btn) => {
    if (btn) btn.classList.add('holding');
  });

  if (sosText) sosText.textContent = `Hold 3s`;
  if (sosBtnMobile) sosBtnMobile.textContent = `Hold 3s...`;

  if ('vibrate' in navigator) {
    try { navigator.vibrate(40); } catch (_) {}
  }

  sosHoldTimer = setInterval(() => {
    holdSeconds--;
    if (sosText) sosText.textContent = `Hold ${holdSeconds}s`;
    if (sosBtnMobile) sosBtnMobile.textContent = `Hold ${holdSeconds}s...`;

    if (holdSeconds <= 0) {
      clearInterval(sosHoldTimer);
      sosHoldTimer = null;
      triggerDirectSOS();
    }
  }, 1000);
}

function cancelSOSHold() {
  if (isSOSSending || isSOSActive) return;
  if (sosHoldTimer) {
    clearInterval(sosHoldTimer);
    sosHoldTimer = null;

    const sosBtn = document.getElementById('sosActionBtn');
    const sosBtnMobile = document.getElementById('sosActionBtnMobile');
    const sosText = document.querySelector('#sosActionBtn span:last-child');

    [sosBtn, sosBtnMobile].forEach((btn) => {
      if (btn) btn.classList.remove('holding');
    });

    if (sosText) sosText.textContent = 'SOS';
    if (sosBtnMobile) sosBtnMobile.textContent = 'Hold to SOS';
  }
}

async function triggerDirectSOS() {
  if (isSOSSending) return;
  isSOSSending = true;

  const sosBtn = document.getElementById('sosActionBtn');
  const sosBtnMobile = document.getElementById('sosActionBtnMobile');
  const sosText = document.querySelector('#sosActionBtn span:last-child');

  // UI to sending state
  [sosBtn, sosBtnMobile].forEach((btn) => {
    if (!btn) return;
    btn.classList.remove('holding');
    btn.classList.add('sos-sending');
  });

  if (sosText) sosText.textContent = 'Sending...';
  if (sosBtnMobile) sosBtnMobile.textContent = 'Sending SOS...';

  if ('vibrate' in navigator) {
    try { navigator.vibrate([150, 80, 150]); } catch (_) {}
  }

  g.showToast?.('📡 Acquiring high-precision GPS coordinates...');

  // 1. Get location with permission assurance
  let lat = null;
  let lng = null;
  let accuracy = 15;

  // If live GPS tracking is already active and locked, use currentPosition
  if (currentPosition && typeof currentPosition.lat === 'number' && typeof currentPosition.lng === 'number') {
    lat = currentPosition.lat;
    lng = currentPosition.lng;
    console.log('✅ Using active continuous GPS coordinates for SOS:', lat, lng);
  } else if (navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
      });
      lat = Number(pos.coords.latitude);
      lng = Number(pos.coords.longitude);
      accuracy = pos.coords.accuracy || 15;
      currentPosition = { lat, lng };
      console.log('✅ Acquired direct GPS coordinates for SOS:', lat, lng, `(±${accuracy}m)`);
    } catch (geoErr) {
      console.warn('Geolocation acquisition note:', geoErr);
      if (geoErr.code === geoErr.PERMISSION_DENIED) {
        alert("🚨 Location Permission Required!\n\nPlease allow location access in your browser so rescue teams can navigate directly to your coordinates during floods.");
        isSOSSending = false;
        [sosBtn, sosBtnMobile].forEach((btn) => {
          if (!btn) return;
          btn.classList.remove('sos-sending', 'holding');
        });
        if (sosText) sosText.textContent = 'SOS';
        if (sosBtnMobile) sosBtnMobile.textContent = 'Hold to SOS';
        return;
      }
    }
  }

  // Fallback to Kamareddy base only if GPS hardware timed out
  if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) {
    lat = 18.3221;
    lng = 78.3033;
    console.warn('GPS hardware timed out, using baseline location:', lat, lng);
  }

  // 2. Reverse Geocode place name for human-readable location address
  let addressText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  try {
    const geoController = new AbortController();
    const geoTimer = setTimeout(() => geoController.abort(), 2500);
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`, {
      signal: geoController.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(geoTimer);

    if (geoRes.ok) {
      const geoData = await geoRes.json();
      const addr = geoData.address || {};
      const placeName = geoData.name || addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || 'Kamareddy';
      const district = addr.county || addr.state_district || addr.district || 'Kamareddy';
      const state = addr.state || 'Telangana';
      const road = addr.road ? `${addr.road}, ` : '';
      addressText = `${road}${placeName}, ${district}, ${state}`;
    }
  } catch (_) {
    addressText = `Kamareddy Area (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }

  // 3. Weather & Priority
  let priority = 'High';
  try {
    const weatherURL = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=4d883e189d23fe24b5e2a63da587a352&units=metric`;
    const res = await fetch(weatherURL);
    if (res.ok) {
      const wData = await res.json();
      const rainfall = (wData.rain && wData.rain['1h']) ? Number(wData.rain['1h']) : 0;
      const weatherMain = wData.weather?.[0]?.main || '';

      if (weatherMain === 'Thunderstorm' || rainfall > 20 || weatherMain === 'Extreme') {
        priority = 'High';
      } else if (rainfall > 5) {
        priority = 'Medium';
      } else {
        priority = 'High';
      }
    }
  } catch (wErr) {
    console.warn('Weather API fallback to High priority:', wErr);
  }

  const citizenName = window.currentUserName || localStorage.getItem('userName') || 'Citizen';
  const timestamp = new Date().toISOString();

  // 4. Upload to Firestore with strictly numeric lat/lng and descriptive location
  try {
    const db = window.firebaseDb;
    const collectionFn = window.firebaseCollection;
    const addDocFn = window.firebaseAddDoc;
    const serverTimestampFn = window.firebaseServerTimestamp;

    const sosPayload = {
      name: citizenName,
      location: addressText,
      address: addressText,
      lat: Number(lat),
      lng: Number(lng),
      status: 'pending',
      priority: priority,
      timestamp: timestamp,
      accuracy: accuracy,
      createdAt: serverTimestampFn ? serverTimestampFn() : timestamp
    };

    if (db && collectionFn && addDocFn) {
      const docRef = await addDocFn(collectionFn(db, 'sos'), sosPayload);
      if (docRef && docRef.id) activeSosDocId = docRef.id;
    } else if (window.db && typeof window.db.collection === 'function') {
      const docRef = await window.db.collection('sos').add({
        ...sosPayload,
        createdAt: (window.firebase && window.firebase.firestore && window.firebase.firestore.FieldValue)
          ? window.firebase.firestore.FieldValue.serverTimestamp()
          : timestamp
      });
      if (docRef && docRef.id) activeSosDocId = docRef.id;
    } else {
      console.warn('Offline fallback for SOS');
      localStorage.setItem('pending_sos_alert', JSON.stringify(sosPayload));
    }

    isSOSActive = true;
    isSOSSending = false;

    // 4. Update UI to SOS Sent!
    [sosBtn, sosBtnMobile].forEach((btn) => {
      if (!btn) return;
      btn.classList.remove('sos-sending', 'holding');
      btn.classList.add('sos-sent');
    });

    if (sosText) sosText.textContent = 'SOS Sent!';
    if (sosBtnMobile) sosBtnMobile.textContent = '✅ SOS Sent!';

    // Status card indicator
    const statChip = document.querySelector('.status-card .stat-chip');
    if (statChip) {
      statChip.textContent = '🚨 SOS Sent';
      statChip.style.background = 'rgba(239, 68, 68, 0.25)';
      statChip.style.color = '#fca5a5';
      statChip.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    }

    // Leaflet beacon on map
    if (map && typeof L !== 'undefined') {
      try {
        map.flyTo([lat, lng], 15, { animate: true, duration: 1.5 });
        const sosIcon = L.divIcon({
          className: 'sos-map-beacon',
          html: '<div class="sos-beacon-pulse"></div><div class="sos-beacon-dot">🚨</div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });
        L.marker([lat, lng], { icon: sosIcon })
          .addTo(map)
          .bindPopup(`<b>🚨 EMERGENCY SOS SENT</b><br>Priority: <span style="color:#ef4444;font-weight:bold">${priority}</span><br>Status: Pending Rescue Team<br><small>${timestamp}</small>`)
          .openPopup();
      } catch (mapErr) {
        console.warn('Map marker update note:', mapErr);
      }
    }

    // Web Audio chime
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (_) {}

    g.showToast?.(`🚨 SOS Sent! Rescue teams notified. Priority: ${priority}`);

    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200, 100, 400]); } catch (_) {}
    }

  } catch (err) {
    console.error('Error dispatching SOS:', err);
    isSOSSending = false;
    [sosBtn, sosBtnMobile].forEach((btn) => {
      if (!btn) return;
      btn.classList.remove('sos-sending', 'holding');
    });
    if (sosText) sosText.textContent = 'SOS';
    if (sosBtnMobile) sosBtnMobile.textContent = 'Hold to SOS';
    g.showToast?.('⚠️ SOS dispatch error. Please try again!');
  }
}

function renderAlerts(list = null) {
  const container = document.getElementById('alertsList');
  if (!container) return;

  const alerts = list !== null ? list : alertsData;

  if (!alerts || alerts.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:32px 16px;color:#94a3b8;font-size:0.88rem;">
        <div style="font-size:2.2rem;margin-bottom:8px;">✅</div>
        <div style="font-weight:700;color:#f8fafc;margin-bottom:4px;font-size:1rem;">No Active Flood Alerts</div>
        <div style="line-height:1.45;">All sectors across Kamareddy are currently safe. Rescue teams are continuously monitoring telemetry.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = alerts.map((alert) => `
    <div class="alert-item ${alert.severity}" style="${alert.status === 'resolved' ? 'opacity:0.65;' : ''}">
      <header>
        <div style="display:flex;align-items:center;gap:8px;">
          <span>${alert.severity === 'danger' ? '🚨' : (alert.severity === 'warning' ? '⚠️' : '📢')}</span>
          <h4>${escapeHtml(alert.title)}</h4>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${alert.status === 'resolved' ? '<span style="font-size:0.65rem;padding:2px 7px;border-radius:999px;background:rgba(16,185,129,0.2);color:#34d399;font-weight:700;letter-spacing:0.04em;">RESOLVED</span>' : ''}
          <span class="alert-badge ${alert.severity}">${alert.severity === 'danger' ? 'CRITICAL' : alert.severity.toUpperCase()}</span>
        </div>
      </header>
      <p>${escapeHtml(alert.message)}</p>
      <small>${alert.time}</small>
    </div>
  `).join('');
}

let _isFirstAlertsSnapshot = true;

function setupRealtimeAlertsListener() {
  // Initial empty/cached render so modal is never blank
  renderAlerts();

  let checkAttempts = 0;
  const checkInterval = setInterval(() => {
    checkAttempts++;
    if (window.firebaseDb && window.firebaseFirestoreModule) {
      clearInterval(checkInterval);
      const { collection, onSnapshot } = window.firebaseFirestoreModule;
      if (!collection || !onSnapshot) return;

      try {
        const alertsCol = collection(window.firebaseDb, 'alerts');

        onSnapshot(alertsCol, (snapshot) => {
          const liveAlerts = [];
          let activeCount = 0;
          let newestAlert = null;

          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const status = data.status || 'active';
            if (status === 'active') activeCount++;

            // Map Rescue alert types to Citizen CSS severity ('danger', 'warning', 'info')
            let severity = 'info';
            const t = (data.type || '').toLowerCase();
            if (t.includes('emergency') || t.includes('critical') || t.includes('danger')) {
              severity = 'danger';
            } else if (t.includes('warning') || t.includes('surge') || t.includes('warn')) {
              severity = 'warning';
            } else {
              severity = 'info';
            }

            // Extract numeric timestamp for accurate sorting
            let rawTimeMs = 0;
            let timeStr = 'Just now';
            if (data.timestamp) {
              try {
                const d = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
                rawTimeMs = d.getTime();
                const diffSec = Math.floor((Date.now() - rawTimeMs) / 1000);
                if (diffSec < 60) timeStr = 'Just now';
                else if (diffSec < 3600) timeStr = `${Math.floor(diffSec / 60)}m ago`;
                else if (diffSec < 86400) timeStr = `${Math.floor(diffSec / 3600)}h ago`;
                else timeStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
              } catch (_) {}
            }

            const alertObj = {
              id: docSnap.id,
              title: data.title || 'Official Rescue Advisory',
              message: data.message || '',
              severity: severity,
              status: status,
              time: timeStr,
              rawTimeMs: rawTimeMs
            };

            liveAlerts.push(alertObj);
          });

          // Sort descending: newest alerts first
          liveAlerts.sort((a, b) => b.rawTimeMs - a.rawTimeMs);

          if (liveAlerts.length > 0 && liveAlerts[0].status === 'active') {
            newestAlert = liveAlerts[0];
          }

          alertsData = liveAlerts;

          // Update live badge counter on Sidebar Alerts button
          const alertsBtn = document.getElementById('alertsOpenBtn');
          if (alertsBtn) {
            if (activeCount > 0) {
              alertsBtn.setAttribute('data-badge', String(activeCount));
            } else {
              alertsBtn.removeAttribute('data-badge');
            }
          }

          // If new active broadcast arrived in real-time, show notification toast
          if (!_isFirstAlertsSnapshot && newestAlert) {
            g.showToast?.(`📢 Emergency Alert: ${newestAlert.title}`);
          }
          _isFirstAlertsSnapshot = false;

          renderAlerts(liveAlerts);
        }, (err) => {
          console.error('Realtime Firebase alerts listener error:', err);
        });
      } catch (err) {
        console.error('Failed to bind Firestore alerts listener:', err);
      }
    } else if (checkAttempts > 40) {
      clearInterval(checkInterval);
    }
  }, 200);
}

// Run initPage when DOM is fully loaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage);
  } else {
    initPage();
  }
}
