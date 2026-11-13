function setSOSButtonState(button, state) {
  if (!button) return;
  button.classList.remove('sos-idle', 'sos-locating', 'sos-confirming', 'sos-sending', 'sos-sent', 'sos-error');
  button.classList.add(`sos-${state}`);
  if (state === 'sending' || state === 'locating' || state === 'confirming') {
    button.disabled = true;
  } else {
    button.disabled = false;
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Reverse geocode failed');
    const data = await res.json();
    return data.display_name || null;
  } catch (err) {
    console.warn('Reverse geocode error:', err);
    return null;
  }
}

async function triggerOneTapSOS(button, callback, options = {}) {
  if (!button || typeof callback !== 'function') return;

  setSOSButtonState(button, 'locating');
  const locationField = options.locationField || null;

  if (locationField) {
    locationField.readOnly = true;
    locationField.placeholder = 'Capturing location…';
    locationField.value = '';
  }

  if (!navigator.geolocation) {
    setSOSButtonState(button, 'error');
    alert('Geolocation is not supported by this browser. Please enter your location manually.');
    if (locationField) {
      locationField.readOnly = false;
      locationField.placeholder = 'Enter your location manually';
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(async (position) => {
    setSOSButtonState(button, 'confirming');

    const latitude = Number(position.coords.latitude);
    const longitude = Number(position.coords.longitude);
    const timestamp = new Date().toISOString();
    const address = await reverseGeocode(latitude, longitude);

    if (locationField && address) {
      locationField.value = address;
    } else if (locationField) {
      locationField.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    }

    const sosData = {
      userName: options.userName || '',
      latitude,
      longitude,
      address,
      timestamp,
    };

    setSOSButtonState(button, 'sending');

    try {
      await callback(sosData);
      setSOSButtonState(button, 'sent');
      setTimeout(() => setSOSButtonState(button, 'idle'), 2500);
    } catch (error) {
      console.error('SOS callback error:', error);
      setSOSButtonState(button, 'error');
      alert('Unable to send SOS right now. Please try again.');
      if (locationField) {
        locationField.readOnly = false;
        locationField.placeholder = 'You can enter location manually if needed';
      }
    }
  }, (error) => {
    console.warn('Geolocation error:', error);
    setSOSButtonState(button, 'error');

    if (error.code === error.PERMISSION_DENIED) {
      alert('Location access denied. Please allow location or enter your location manually.');
      if (locationField) {
        locationField.readOnly = false;
        locationField.placeholder = 'Enter your location manually';
      }
    } else {
      alert('Unable to get your location. Please try again.');
    }
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0,
  });
}

async function sendSOSToBackend(sosData) {
  if (typeof window.db !== 'undefined') {
    const rawName = sosData.userName || '';
    const normalizedName = rawName.trim();
    const isAnonymous = normalizedName === '' || normalizedName.toLowerCase() === 'guest';
    const name = isAnonymous ? 'Unknown / Unlogged' : rawName.trim();
    const address = sosData.address || `${sosData.latitude}, ${sosData.longitude}`;
    const documentData = {
      name,
      location: address,
      lat: Number(sosData.latitude),
      lng: Number(sosData.longitude),
      address,
      status: 'pending',
      priority: 'Medium',
      userType: isAnonymous ? 'anonymous' : 'registered',
      source: isAnonymous ? 'landing-anonymous' : 'app',
      createdAt: window.firebase?.firestore?.FieldValue?.serverTimestamp ? window.firebase.firestore.FieldValue.serverTimestamp() : new Date(),
      timestamp: sosData.timestamp,
    };

    await window.db.collection('sos').add(documentData);
    alert('🚨 SOS Sent! Help is on the way.');
    if (document.getElementById('location')) {
      document.getElementById('location').value = address;
    }
    if (document.getElementById('name') && document.getElementById('name').value.trim() === '') {
      document.getElementById('name').value = isAnonymous ? '' : name;
    }
    if (typeof window.loadHistory === 'function') {
      window.loadHistory();
    }
    return;
  }

  console.warn('sendSOSToBackend() requires backend initialization. Saving SOS.');
  sessionStorage.setItem('pendingSOS', JSON.stringify(sosData));
  window.location.href = 'main.html';
}
