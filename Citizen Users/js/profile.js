import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDDc8peb4i19Rku8smgr5BwLxt0WMB9Gjw",
  authDomain: "flood-rescue-guide-ac3a8.firebaseapp.com",
  projectId: "flood-rescue-guide-ac3a8",
  storageBucket: "flood-rescue-guide-ac3a8.appspot.com",
  messagingSenderId: "635830559756",
  appId: "1:635830559756:web:xxxxxx"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function populateProfile(user, data) {
  const safeData = data || {};
  document.getElementById("userName").innerText = safeData.name || "Citizen User";
  document.getElementById("userEmail").innerText = safeData.email || user?.email || "No email";
  document.getElementById("userPhone").innerText = safeData.phone || "----------";
  document.getElementById("userRole").innerText = safeData.role || "Citizen";
  document.getElementById("userLocation").innerText = safeData.location || "---";
  document.getElementById("activeSOSCount").innerText = safeData.activeSOS ?? 0;
  document.getElementById("alertCount").innerText = safeData.alerts ?? 0;
}

window.addEventListener("DOMContentLoaded", () => {
  const startedFromMain = sessionStorage.getItem('startedFromMain') === 'true';
  const bypassAuth = !startedFromMain || localStorage.getItem('bypassAuth') === 'true';

  if (bypassAuth) {
    console.log('⚠️ Firebase Auth Guard bypassed (opened directly or via bypass flag) in profile.js');
    populateProfile(null, {
      name: "Mock Citizen User",
      email: "mock@citizen.com",
      phone: "123-456-7890",
      role: "citizen",
      location: "Kamareddy",
      activeSOS: 0,
      alerts: 2
    });
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      console.warn("User not logged in");
      window.location.href = "login.html";
      return;
    }

    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists()) {
        alert("Profile data not found in database");
        return;
      }

      populateProfile(user, snap.data());
    } catch (err) {
      console.error("Profile load error:", err);
    }
  });
});

window.goHome = function () {
  window.location.href = "home.html";
};

window.logout = async function () {
  const confirmLogout = confirm("Are you sure you want to logout?");
  if (!confirmLogout) return;

  await signOut(auth);
  alert("Logged out successfully");
  window.location.href = "login.html";
};
