import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "../js/firebase-auth.js";

/* =========================================================
   State & Elements
   ========================================================= */
const alertsList = document.getElementById("alertsList");
const titleInput = document.getElementById("title");
const messageInput = document.getElementById("message");
const typeSelect = document.getElementById("type");
const sendBtn = document.getElementById("sendBtn");
const sendBtnText = document.getElementById("sendBtnText");

const topActiveCount = document.getElementById("topActiveCount");
const countAll = document.getElementById("countAll");
const countActive = document.getElementById("countActive");
const countResolved = document.getElementById("countResolved");
const toastEl = document.getElementById("toastMsg");

let currentFilter = "all";
let cachedAlerts = [];

/* =========================================================
   Toast Notification Helper
   ========================================================= */
let toastTimer = null;
function showToast(html, duration = 3000) {
  if (!toastEl) return;
  toastEl.innerHTML = html;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
  }, duration);
}

/* =========================================================
   Format Timestamp Helper
   ========================================================= */
function formatTimestamp(ts) {
  if (!ts) return "Just now";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);

    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch (_) {
    return "Recent";
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   Filter Tabs Handling
   ========================================================= */
document.querySelectorAll(".tab-filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.getAttribute("data-filter") || "all";
    renderAlerts();
  });
});

/* =========================================================
   Render Alerts List
   ========================================================= */
function renderAlerts() {
  if (!alertsList) return;

  let totalActive = 0;
  let totalResolved = 0;

  cachedAlerts.forEach((a) => {
    if (a.status === "resolved") {
      totalResolved++;
    } else {
      totalActive++;
    }
  });

  if (topActiveCount) topActiveCount.textContent = totalActive;
  if (countAll) countAll.textContent = cachedAlerts.length;
  if (countActive) countActive.textContent = totalActive;
  if (countResolved) countResolved.textContent = totalResolved;

  // Filter based on active tab
  const filtered = cachedAlerts.filter((a) => {
    if (currentFilter === "active") return a.status !== "resolved";
    if (currentFilter === "resolved") return a.status === "resolved";
    return true; // 'all'
  });

  if (filtered.length === 0) {
    alertsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">No Alerts in this category</div>
        <div class="empty-sub">Active flood broadcasts and advisories will be listed here in real-time.</div>
      </div>
    `;
    return;
  }

  alertsList.innerHTML = "";

  filtered.forEach((a) => {
    const card = document.createElement("div");
    const isResolved = a.status === "resolved";
    const alertType = (a.type || "info").toLowerCase();
    const typeLabel = alertType === "emergency" ? "Critical Emergency" : (alertType === "warning" ? "Evacuation Warning" : "Advisory");
    const typeIcon = alertType === "emergency" ? "🚨" : (alertType === "warning" ? "⚠️" : "ℹ️");

    card.className = `alert-item-card ${alertType} ${a.status || 'active'}`;

    card.innerHTML = `
      <div class="alert-card-top">
        <span class="alert-type-badge ${alertType}">
          <span>${typeIcon}</span>
          <span>${typeLabel}</span>
        </span>

        <div class="alert-meta">
          <span>🕒 ${formatTimestamp(a.timestamp)}</span>
          <span class="status-pill ${isResolved ? 'resolved' : 'active'}">
            ${isResolved ? '✓ RESOLVED' : '● ACTIVE'}
          </span>
        </div>
      </div>

      <h3 class="alert-card-title">${escapeHtml(a.title)}</h3>
      <p class="alert-card-msg">${escapeHtml(a.message)}</p>

      <div class="alert-card-actions">
        <div>
          ${
            !isResolved
              ? `<button type="button" class="btn-resolve" data-id="${a.id}">
                   <span>✓</span> Mark Resolved
                 </button>`
              : `<button type="button" class="btn-reopen" data-id="${a.id}">
                   <span>↩</span> Re-activate Alert
                 </button>`
          }
        </div>

        <div>
          <button type="button" class="btn-delete" data-id="${a.id}" title="Delete alert broadcast">
            <span>🗑️</span> Delete
          </button>
        </div>
      </div>
    `;

    alertsList.appendChild(card);
  });

  // Attach button event listeners
  document.querySelectorAll(".btn-resolve").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      try {
        await updateDoc(doc(db, "alerts", id), { status: "resolved" });
        showToast("✅ Alert marked as <strong>Resolved</strong>.");
      } catch (err) {
        console.error("Resolve error:", err);
        alert("Error updating alert: " + err.message);
      }
    });
  });

  document.querySelectorAll(".btn-reopen").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      try {
        await updateDoc(doc(db, "alerts", id), { status: "active" });
        showToast("⚡ Alert re-opened as <strong>Active</strong>.");
      } catch (err) {
        console.error("Reopen error:", err);
        alert("Error updating alert: " + err.message);
      }
    });
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (confirm("Are you sure you want to permanently delete this alert broadcast?")) {
        try {
          await deleteDoc(doc(db, "alerts", id));
          showToast("🗑️ Alert deleted permanently.");
        } catch (err) {
          console.error("Delete error:", err);
          alert("Error deleting alert: " + err.message);
        }
      }
    });
  });
}

/* =========================================================
   Realtime Firestore Listener
   ========================================================= */
const alertsQuery = query(
  collection(db, "alerts"),
  orderBy("timestamp", "desc")
);

onSnapshot(alertsQuery, (snapshot) => {
  cachedAlerts = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    cachedAlerts.push({
      id: docSnap.id,
      title: data.title || "Untitled Alert",
      message: data.message || "",
      type: data.type || "emergency",
      status: data.status || "active",
      timestamp: data.timestamp
    });
  });
  renderAlerts();
});

/* =========================================================
   Send Alert Handler
   ========================================================= */
sendBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim();
  const message = messageInput.value.trim();
  const type = typeSelect.value;

  if (!title || !message) {
    alert("Please enter both an alert title and message.");
    return;
  }

  sendBtn.disabled = true;
  sendBtnText.textContent = "Broadcasting Alert...";

  try {
    await addDoc(collection(db, "alerts"), {
      title: title,
      message: message,
      type: type,
      status: "active",
      timestamp: serverTimestamp()
    });

    titleInput.value = "";
    messageInput.value = "";
    showToast("🚀 Emergency Alert <strong>Broadcasted</strong> to all field teams & citizens!");
  } catch (error) {
    console.error("Broadcast Error:", error);
    alert("Firestore error: " + error.message);
  } finally {
    sendBtn.disabled = false;
    sendBtnText.textContent = "Broadcast Alert to All";
  }
});

/* =========================================================
   Quick Template Autofill
   ========================================================= */
window.fillTemplate = function (templateType) {
  if (templateType === "surge") {
    titleInput.value = "Flash Flood Warning - Lowland Sectors";
    typeSelect.value = "emergency";
    messageInput.value = "Water levels exceeding safety threshold in lowlands. Move to designated high ground or cyclone shelters immediately.";
  } else if (templateType === "evac") {
    titleInput.value = "Urgent Evacuation Notice - Sector 4 & 5";
    typeSelect.value = "warning";
    messageInput.value = "Rapid water rise observed. Evacuation convoy active along Northern Elevated Corridor. Follow rescue units instructions.";
  } else if (templateType === "safe") {
    titleInput.value = "Safe Corridor Advisory - Kamareddy Bypass";
    typeSelect.value = "info";
    messageInput.value = "The Kamareddy Bypass elevated highway has been inspected and cleared safe for vehicular and rescue passage.";
  }
  titleInput.focus();
};

console.log("📢 Rescue Operations Broadcast Console Ready");