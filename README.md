# Smart Flood Monitoring and Rescue System

An integrated emergency response and disaster management platform designed for both citizens and rescue operations teams during flood scenarios.

---

## 📌 Project Overview

This repository combines AI-assisted decision making, real-time telemetry, geographic risk mapping, and emergency dispatch into a single unified architecture:

1. **Citizen Portal (`/Citizen Users`)**
   - **Emergency SOS & Location Reporting**: One-touch distress beacon with automated geolocation capture.
   - **Flood Risk Assessment**: Grid-based flood risk calculations using geospatial data (`kamareddy_grids.geojson`).
   - **Real-Time Weather & Alerts**: Live alert notifications and weather intelligence.
   - **AI Emergency Assistant**: On-device emergency guidance and safety recommendations.

2. **Rescue Operations Hub (`/Rescue Users`)**
   - **Tactical Dashboard**: Live monitoring of citizen SOS beacons and distress signals.
   - **Tactical Route Planner**: Safe pathing and navigation around submerged or high-risk zones.
   - **Telemetry & Hardware Bridge**: Support for LoRa mesh devices, Raspberry Pi hardware bridges, and offline sensors.
   - **Rescue Alert Dispatch**: Multi-channel broadcast alerts to active rescue teams.

3. **Authentication & Entry Portal (`/Main_starter`)**
   - Unified secure authentication (Login, Signup, Password Recovery).
   - High-visibility SOS quick-action portal.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v16 or higher)
- **Python** (3.9 or higher)
- **Git**

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Jaksani-Abhinav-9/vs--studio-project.git
   cd vs
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the backend service:
   ```bash
   npm start
   ```

4. Launch the Citizen Portal:
   Open `Citizen Users/home.html` or `Main_starter/main.html` in your browser.

5. Launch the Rescue Operations Portal:
   Open `Rescue Users/home.html` in your browser, or run `Rescue Users/Launch Rescue App.bat`.

---

## 📁 Repository Structure

```text
├── Citizen Users/          # Citizen dashboard, alerts, AI agent, and backend logic
│   ├── ai/                 # AI agents, prompt configurations, tools, and embeddings
│   ├── alerts/             # Alert display and Firebase sync
│   ├── backend/            # Express server, flood logic, and weather checks
│   ├── css/                # Citizen UI stylesheets
│   ├── data/               # GeoJSON grid datasets
│   └── js/                 # Client-side scripts and SOS logic
├── Rescue Users/           # Rescue operations dashboard & tactical tools
│   ├── ai 2.0/             # Route planning, tactical inference, and telemetry models
│   ├── alerts/             # Rescue team alert dispatch system
│   ├── hardware/           # Hardware integration modules
│   └── runtime/            # Runtime tools and Pi hardware bridge
├── Main_starter/           # Unified landing, authentication, and quick SOS
└── package.json            # Node.js dependencies and run scripts
```

---

## 🔒 Security & Privacy
- Sensitive credentials (`.env`), Python environments (`.venv/`, `Lib/`, `Scripts/`), and heavy AI binaries (`*.onnx`, `*.gguf`) are excluded via `.gitignore`.

---

## 👤 Author
- **GitHub**: [@Jaksani-Abhinav-9](https://github.com/Jaksani-Abhinav-9)

