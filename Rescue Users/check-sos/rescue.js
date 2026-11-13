console.log("🚑 Rescue dashboard loaded");

/*************************************************
 * FIREBASE INIT
 *************************************************/
const firebaseConfig = {
  apiKey: "AIzaSyDDc8peb4i19Rku8smgr5BwLxt0WMB9Gjw",
  authDomain: "flood-rescue-guide-ac3a8.firebaseapp.com",
  projectId: "flood-rescue-guide-ac3a8",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let allSOS = [];
let rescueLat = null;
let rescueLng = null;

/*************************************************
 * USE MY LOCATION BUTTON
 *************************************************/
document.addEventListener("click", function(e){
  if(e.target.id === "useLocationBtn"){
    
    navigator.geolocation.getCurrentPosition(position => {

      // ✅ Force numeric
      rescueLat = Number(position.coords.latitude);
      rescueLng = Number(position.coords.longitude);

      console.log("Rescue Base:", rescueLat, rescueLng);
      sessionStorage.setItem("rescueLat", String(rescueLat));
      sessionStorage.setItem("rescueLng", String(rescueLng));

      alert("📍 Rescue base location updated!");
      applyFilter();

    }, error=>{
      alert("Location permission required.");
    });

  }
});

/*************************************************
 * HAVERSINE DISTANCE FUNCTION
 *************************************************/
function getDistance(lat1, lon1, lat2, lon2){

  // ✅ Ensure numeric values
  lat1 = Number(lat1);
  lon1 = Number(lon1);
  lat2 = Number(lat2);
  lon2 = Number(lon2);

  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLon = (lon2-lon1) * Math.PI/180;

  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI/180) *
    Math.cos(lat2 * Math.PI/180) *
    Math.sin(dLon/2) *
    Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/*************************************************
 * REAL-TIME LISTENER
 *************************************************/
function listenSOS(){

  db.collection("sos")
    .orderBy("createdAt","desc")
    .onSnapshot(snapshot => {

      allSOS = [];
      let liveCount = 0;
      let completedCount = 0;

      snapshot.forEach(doc=>{
        const data = doc.data();
        const rawStatus = (data.status || 'active').trim();
        const st = rawStatus.toLowerCase();
        const isComp = st.startsWith('complete') || st === 'resolved' || st === 'done';

        if (isComp) {
          completedCount++;
        } else {
          liveCount++;
        }

        let lat = Number(data.lat);
        let lng = Number(data.lng);

        // Fallback: If lat or lng is NaN/missing, extract from location string if it contains coordinates (e.g. "18.326285, 78.332664")
        if (isNaN(lat) || isNaN(lng) || lat === 0) {
          if (data.location && typeof data.location === 'string') {
            const match = data.location.match(/([0-9]+\.[0-9]+)[,\s]+([0-9]+\.[0-9]+)/);
            if (match) {
              lat = parseFloat(match[1]);
              lng = parseFloat(match[2]);
            }
          }
        }

        // If coordinates could not be parsed, mark as null without hardcoding
        if (isNaN(lat) || isNaN(lng) || lat === 0) {
          lat = null;
          lng = null;
        }

        allSOS.push({
          id: doc.id,
          ...data,
          status: isComp ? 'completed' : (data.status || 'active'),
          lat: lat,
          lng: lng
        });
      });

      const liveBadge = document.getElementById("liveSosCount");
      if (liveBadge) liveBadge.innerText = liveCount;
      const compBadge = document.getElementById("completedSosCount");
      if (compBadge) compBadge.innerText = completedCount;

      applyFilter();
    });
}

let currentViewTab = 'live'; // 'live' | 'completed' | 'all'

function switchSOSTab(tabName) {
  currentViewTab = tabName;

  document.querySelectorAll('.screen-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  if (tabName === 'live') {
    document.getElementById('tabLive')?.classList.add('active');
  } else if (tabName === 'completed') {
    document.getElementById('tabCompleted')?.classList.add('active');
  } else {
    document.getElementById('tabAll')?.classList.add('active');
  }

  applyFilter();
}
window.switchSOSTab = switchSOSTab;

function updateTallyCounts() {
  let liveCount = 0;
  let completedCount = 0;

  allSOS.forEach(item => {
    const st = (item.status || 'active').trim().toLowerCase();
    if (st === 'completed' || st.startsWith('complete') || st === 'resolved' || st === 'done') {
      completedCount++;
    } else {
      liveCount++;
    }
  });

  const tabLive = document.getElementById("tabLiveBadge");
  const tabComp = document.getElementById("tabCompletedBadge");
  const tabAll = document.getElementById("tabAllBadge");

  if (tabLive) tabLive.innerText = liveCount;
  if (tabComp) tabComp.innerText = completedCount;
  if (tabAll) tabAll.innerText = allSOS.length;
}

/*************************************************
 * APPLY FILTER & RENDER
 *************************************************/
function applyFilter(){
  updateTallyCounts();

  const priorityFilter = document.getElementById("filterSelect").value;
  const container = document.getElementById("sosList");
  container.innerHTML = "";

  let filtered = allSOS;

  // 1. Filter by Active Screen Tab
  if (currentViewTab === 'live') {
    filtered = allSOS.filter(item => {
      const st = (item.status || 'pending').trim().toLowerCase();
      return st !== 'completed' && !st.startsWith('complete') && st !== 'resolved';
    });
  } else if (currentViewTab === 'completed') {
    filtered = allSOS.filter(item => {
      const st = (item.status || 'pending').trim().toLowerCase();
      return st === 'completed' || st.startsWith('complete') || st === 'resolved';
    });
  }

  // 2. Filter by priority dropdown if selected
  if (priorityFilter !== "all") {
    filtered = filtered.filter(item => 
      item.priority?.toLowerCase() === priorityFilter
    );
  }

  if (filtered.length === 0) {
    if (currentViewTab === 'live') {
      container.innerHTML = `
        <div style="text-align:center;padding:48px 20px;color:#94a3b8;background:rgba(255,255,255,0.02);border-radius:18px;border:1px dashed rgba(255,255,255,0.08);">
          <span style="font-size:2.2rem;display:block;margin-bottom:10px;">🎉</span>
          <strong style="color:#f8fafc;font-size:1.15rem;display:block;margin-bottom:6px;">No Live / Pending SOS</strong>
          <span style="font-size:0.86rem;color:#64748b;">All emergency requests have been attended to or completed.</span>
        </div>
      `;
    } else if (currentViewTab === 'completed') {
      container.innerHTML = `
        <div style="text-align:center;padding:48px 20px;color:#94a3b8;background:rgba(255,255,255,0.02);border-radius:18px;border:1px dashed rgba(255,255,255,0.08);">
          <span style="font-size:2.2rem;display:block;margin-bottom:10px;">📋</span>
          <strong style="color:#f8fafc;font-size:1.15rem;display:block;margin-bottom:6px;">No Completed Rescues Yet</strong>
          <span style="font-size:0.86rem;color:#64748b;">Rescues marked as completed will appear here.</span>
        </div>
      `;
    } else {
      container.innerHTML = "<p style='text-align:center;padding:30px;color:#94a3b8;'>No matching SOS found.</p>";
    }
    return;
  }

  filtered.forEach(d=>{
    const div = document.createElement("div");
    div.className = "sos-card " + (d.priority?.toLowerCase());

    const displayName = d.name && d.name !== 'Guest' ? d.name : 'Unknown / Unlogged';
    const displayLocation = d.location || `${d.lat}, ${d.lng}`;
    const st = (d.status || 'pending').trim().toLowerCase();
    const isCompleted = st === 'completed' || st.startsWith('complete') || st === 'resolved';

    let statusBadgeHtml = '';
    if (isCompleted) {
      statusBadgeHtml = `<span class="status-chip completed">✓ Completed</span>`;
    } else if (st === 'active') {
      statusBadgeHtml = `<span class="status-chip active">Active</span>`;
    } else {
      statusBadgeHtml = `<span class="status-chip pending">Pending</span>`;
    }

    div.innerHTML = `
      <div class="sos-details">
        <div>
          <span>Name</span>
          <strong>${displayName}</strong>
        </div>
        <div>
          <span>Location</span>
          <strong>${displayLocation}</strong>
        </div>
        <div>
          <span>Priority</span>
          <strong style="color: ${d.priority?.toLowerCase() === 'high' ? 'var(--danger)' : d.priority?.toLowerCase() === 'medium' ? 'var(--warning)' : 'var(--success)'}; text-transform: capitalize;">${d.priority}</strong>
        </div>
        <div>
          <span>Current Status</span>
          <div>${statusBadgeHtml}</div>
        </div>
      </div>
      <div class="card-actions" style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;"></div>
    `;

    const actionsContainer = div.querySelector(".card-actions");

    // STATUS ACTION BUTTONS
    if (isCompleted) {
      const reopenBtn = document.createElement("button");
      reopenBtn.innerHTML = "↩ Re-open to Live";
      reopenBtn.className = "active-btn";
      reopenBtn.title = "Move back to Live SOS";
      reopenBtn.onclick = async () => {
        await updateStatus(d.id, "active", false);
        switchSOSTab('live');
      };
      actionsContainer.appendChild(reopenBtn);
    } else {
      // Active / Incoming SOS: Yellow button says '✓ Rescue Completed'
      const compBtn = document.createElement("button");
      compBtn.innerHTML = "✓ Rescue Completed";
      compBtn.className = "rescue-complete-yellow-btn";
      compBtn.title = "Click to mark this rescue as completed";
      compBtn.onclick = async (e) => {
        const btn = e.currentTarget;
        // 1. Immediately updates to green with '✓ Marked Complete'
        btn.classList.add("marked-complete");
        btn.innerHTML = "✓ Marked Complete";
        btn.disabled = true;

        // 2. Brief animation delay so user sees feedback, then moves to right side
        setTimeout(async () => {
          await updateStatus(d.id, "completed", true);
        }, 280);
      };
      actionsContainer.appendChild(compBtn);
    }

    /*************************************************
     * NAVIGATION BUTTON (GOOGLE MAPS RESCUE NAVIGATION)
     *************************************************/
    const navBtn = document.createElement("button");
    navBtn.innerText = "Navigate 🚑";
    navBtn.className = "nav-btn";

    navBtn.onclick = () => {
      if (d.lat === null || d.lng === null || isNaN(d.lat) || isNaN(d.lng)) {
        showToast("⚠️ Cannot navigate: This incident has no GPS coordinates attached.");
        return;
      }
      const destLat = Number(d.lat);
      const destLng = Number(d.lng);
      const priority = encodeURIComponent(d.priority || 'high');
      const victimName = encodeURIComponent(displayName);
      const sosId = encodeURIComponent(d.id || '');

      let url = `../home.html?nav=1&destLat=${destLat}&destLng=${destLng}&name=${victimName}&priority=${priority}&sosId=${sosId}`;

      const curStartLat = rescueLat !== null ? rescueLat : sessionStorage.getItem("rescueLat");
      const curStartLng = rescueLng !== null ? rescueLng : sessionStorage.getItem("rescueLng");

      if (curStartLat && curStartLng) {
        url += `&startLat=${curStartLat}&startLng=${curStartLng}`;
      }

      window.location.href = url;
    };

    actionsContainer.appendChild(navBtn);
    container.appendChild(div);
  });
}

/*************************************************
 * TOAST NOTIFICATION HELPER
 *************************************************/
function showToast(htmlMsg) {
  let toast = document.getElementById("rescueToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "rescueToast";
    document.body.appendChild(toast);
  }
  toast.innerHTML = htmlMsg;
  toast.classList.add("show");
  clearTimeout(window.__rescueToastTimer);
  window.__rescueToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

/*************************************************
 * UPDATE STATUS WITH IMMEDIATE UI REACTION & PERSISTENCE
 *************************************************/
async function updateStatus(id, newStatus, autoSwitchRight = false){
  try {
    console.log(`[Status Update] Updating SOS #${id} to '${newStatus}'...`);

    // 1. Instant local update for zero latency
    const target = allSOS.find(item => item.id === id);
    if (target) {
      target.status = newStatus;
    }

    // 2. If marked completed and autoSwitchRight requested, switch tab to Completed Rescues (right side)
    if (newStatus === 'completed' && autoSwitchRight) {
      currentViewTab = 'completed';
      document.querySelectorAll('.screen-tab').forEach(b => b.classList.remove('active'));
      document.getElementById('tabCompleted')?.classList.add('active');
    }

    // 3. Re-filter view immediately
    applyFilter();

    // 4. Persist to Firestore with fallback
    try {
      await db.collection("sos").doc(id).update({
        status: newStatus,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch (fireErr) {
      console.warn("Retrying Firestore update with basic payload:", fireErr);
      await db.collection("sos").doc(id).update({
        status: newStatus
      });
    }

    console.log(`[Status Update] Successfully persisted '${newStatus}' to Firestore for #${id}`);

    if (newStatus === 'completed') {
      showToast("✅ Rescue updated to <strong>Completed</strong> and moved to <strong>Completed Rescues</strong>!");
    } else if (newStatus === 'active') {
      showToast("⚡ Rescue status set to <strong>Active</strong>!");
    } else {
      showToast("↩ SOS re-opened and returned to <strong>Live / Pending</strong>.");
    }

  } catch (err) {
    console.error("Firestore status update failed:", err);
    // Revert local state on error
    const target = allSOS.find(item => item.id === id);
    if (target) {
      target.status = 'active';
      applyFilter();
    }
    alert("Could not update status: " + err.message);
  }
}
window.updateStatus = updateStatus;

/*************************************************
 * FILTER CHANGE EVENT
 *************************************************/
document.addEventListener("change", function(e){
  if(e.target.id === "filterSelect"){
    applyFilter();
  }
});

/*************************************************
 * START
 *************************************************/
listenSOS();
