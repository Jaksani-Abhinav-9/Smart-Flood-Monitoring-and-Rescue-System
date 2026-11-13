console.log("✅ sos.js loaded");

/*************************************************
 * USER ROLE
 *************************************************/
const USER_ROLE = "citizen"; // change to "admin" for rescue team

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

/*************************************************
 * SEND SOS WITH WEATHER PRIORITY
 *************************************************/
async function sendSOS(){
  const name = document.getElementById("name").value.trim();
  const manualLocation = document.getElementById("location").value.trim();

  if(!name){
    alert("Please enter your name before sending SOS.");
    return;
  }

  if(!navigator.geolocation){
    alert("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition(async pos=>{

    // ✅ Ensure numeric values
    const lat = Number(pos.coords.latitude);
    const lng = Number(pos.coords.longitude);
    const timestamp = new Date().toISOString();

    let priority = "Low"; // default

    try{
      const apiKey = "4d883e189d23fe24b5e2a63da587a352";

      const weatherURL =
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;

      const response = await fetch(weatherURL);
      const data = await response.json();

      console.log("🌦 Weather API Data:", data);

      let rainfall = 0;

      if(data.rain && data.rain["1h"]){
        rainfall = data.rain["1h"];
      }

      const weatherMain = data.weather[0].main;

      // 🔴 PRIORITY LOGIC (UNCHANGED)

      if(weatherMain === "Thunderstorm"){
        priority = "High";
      }
      else if(rainfall > 20){
        priority = "High";
      }
      else if(rainfall > 5){
        priority = "Medium";
      }
      else if(weatherMain === "Extreme"){
        priority = "High";
      }
      else{
        priority = "Low";
      }

    }catch(error){
      console.log("Weather API error:", error);
      priority = "Medium"; // fallback safety
    }

    let address = manualLocation;
    if (!address) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        if (res.ok) {
          const d = await res.json();
          const addr = d.address || {};
          const place = d.name || addr.suburb || addr.neighbourhood || addr.village || addr.town || addr.city || 'Kamareddy Area';
          const dist = addr.county || addr.district || 'Kamareddy';
          const road = addr.road ? `${addr.road}, ` : '';
          address = `${road}${place}, ${dist}, Telangana`;
        }
      } catch (_) {}
      if (!address) address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }

    await db.collection("sos").add({
      name: name,
      location: address,
      lat: Number(lat),           // real numeric GPS latitude
      lng: Number(lng),           // real numeric GPS longitude
      address: address,
      status: "active",
      priority: priority,
      timestamp: timestamp,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("🚨 SOS Sent! Priority: " + priority);

    // Optional: clear form after sending
    document.getElementById("name").value = "";
    document.getElementById("location").value = "";

    loadHistory();

  }, error=>{
    if (error.code === error.PERMISSION_DENIED) {
      alert("🚨 Location permission denied. Please allow location access in your browser to send emergency SOS.");
    } else {
      alert("Location access required to send SOS: " + error.message);
    }
  }, {
    enableHighAccuracy: true,
    timeout: 12000,
    maximumAge: 0
  });
}

/*************************************************
 * LOAD HISTORY
 *************************************************/
async function loadHistory(){
  const h=document.getElementById("history");
  h.innerHTML="";

  const snap=await db.collection("sos")
                     .orderBy("createdAt","desc")
                     .get();

  if(snap.empty){
    h.innerHTML="<p>No history</p>";
    updateSOSSidebarGlow();
    return;
  }

  snap.forEach(doc=>{
    const d=doc.data();
    let btn="";

    if(USER_ROLE==="citizen" && d.status!=="completed"){
      btn=`<button class="toggle-btn" onclick="toggleStatus('${doc.id}','completed')">Mark COMPLETED</button>`;
    }

    if(USER_ROLE==="admin" && d.status==="pending"){
      btn=`<button class="toggle-btn" onclick="toggleStatus('${doc.id}','active')">Mark ACTIVE</button>`;
    }

    h.innerHTML+=`
      <div class="sos-card">
        <b>${d.name}</b><br>
        ${d.location}<br>
        <span class="status ${d.status}">${d.status.toUpperCase()}</span><br>
        <span class="priority ${d.priority?.toLowerCase()}">
          Priority: ${d.priority}
        </span>
        ${btn}
      </div>`;
  });

  updateSOSSidebarGlow();
}

/*************************************************
 * UPDATE STATUS
 *************************************************/
async function toggleStatus(id,status){
  await db.collection("sos").doc(id).update({status});
  loadHistory();
}

/*************************************************
 * SIDEBAR GLOW LOGIC
 *************************************************/
async function updateSOSSidebarGlow(){
  const sosBtn = document.getElementById("sosMenu");
  if(!sosBtn) return;

  sosBtn.classList.remove(
    "sos-alert-default",
    "sos-alert-pending"
  );

  const snap = await db.collection("sos").get();

  let hasPending = false;
  let hasActive = false;

  snap.forEach(doc=>{
    const s = doc.data().status;
    if(s === "pending") hasPending = true;
    if(s === "active") hasActive = true;
  });

  if(hasPending){
    sosBtn.classList.add("sos-alert-pending");
  }
  else if(hasActive || snap.empty){
    sosBtn.classList.add("sos-alert-default");
  }
}

window.onload = loadHistory;
setInterval(updateSOSSidebarGlow, 5000);
