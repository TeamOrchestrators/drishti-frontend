# DRISHTI — Polar Operations Dashboard

**Data Reporting & Intelligent Surveillance for High-impact Tracking Interface**

A mission-critical operations dashboard engineered for Antarctic research stations (such as Bharati, Maitri, and Dakshin
Gangotri) to coordinate expeditions, track station personnel, supervise cargo and resupply logistics, monitor inventory
levels, and manage real-time emergency responses in extreme polar environments.

---

## Features

### Mission Overview (`/overview`)

- **Real-Time Operations Telemetry:** Centralized key metric indicators for active expeditions, personnel in motion,
  transit cargo, and open emergency incidents.
- **Priority Incident Escalation:** Dynamic alert banners for active distress beacons and rapid response navigation.
- **Operational Snapshot Widgets:** High-level status cards for expedition readiness, critical inventory alerts, and
  incoming resupply shipments.

### Expedition Planning and Management (`/expeditions`)

- **Traverse Tracking:** Real-time monitoring of planned, active, sheltered, and completed field missions and traverses.
- **Mission Planning Workflows:** Comprehensive expedition creation and update workflows with schedule management, route
  assignment, crew allocation, and resource planning.
- **Context-Aware Team Assignment:** Origin-station-aware team leader selection to ensure assigned leaders are currently
  stationed at the mission departure base.
- **Readiness & Environmental Safeguards:** Status indicators and readiness evaluations for active operations under
  extreme polar weather conditions.

### Personnel Movement and Station Roster (`/personnel`)

- **Station Personnel Directory:** Searchable directory of station personnel across Antarctic research bases with status
  badges (Available, In Transit, Stationed, Inactive, Medical Hold).
- **Personnel Detail Drawer:** Interactive slide-over dossier on desktop (bottom sheet on mobile) displaying current
  station placement or active transit routes, departure/arrival schedules, callsigns, certifications, and complete
  chronological movement audit history.
- **Transit Tracking:** Real-time monitoring of personnel movements between stations with departure, arrival, and
  weather-dependent condition updates.
- **Expedition Assignment:** Mission assignment workflows with validation against station occupancy and availability.

### Cargo and Logistics Tracking (`/cargo`)

- **Priority & Indent Management:** Indent prioritization (Standard / High / Critical) with weight, volume, cargo codes,
  and route tracking.
- **Transport Vessel Coordination:** Multi-modal transport coordination covering icebreakers, supply vessels, and polar
  transport aircraft.
- **Batch Lifecycle Management:** Consignment grouping into logistics batches, manifest assignment, and synchronized
  status updates (Draft, Packed, In Transit, Received, Delayed, Cancelled).
- **Interactive Route Map (`BatchMap`):** Antarctic polar route visualization powered by MapLibre GL, displaying
  departure stations, destination bases, waypoints, and recorded checkpoint positions.
- **Consignment Lifecycle Timeline (`CargoTimeline`):** Visual milestone progression tracking cargo from registration
  and origin packing through traverse transit and final station receiving.
- **QR Code Label Generator (`CargoQrModal`):** Printable and downloadable high-resolution cargo labels featuring QR
  codes, cargo identifiers, origin/destination details, and copyable UUID tokens.

### Dedicated Cargo QR Scanner (`/cargo/scan`)

- **Live Hardware Camera Scanning:** Integrated camera-based barcode/QR scanning powered by `html5-qrcode` with
  multi-camera selection and toggle controls.
- **Image File QR Decoding:** Direct image upload fallback to scan QR codes from photos or scanned documents.
- **Token Lookup & Deep Linking:** Quick search by token or cargo ID, with automatic loading via URL parameters
  (`/cargo/scan?token=<token>`).
- **Checkpoint & Event Logging:** Field logging for cargo checkpoints (Received, Dispatched, Packed, Inspected, Damaged)
  capturing timestamped events, GPS coordinates (via browser geolocation or Antarctic station coordinates), notes, and
  status updates.
- **Field Manifest Inspection:** Real-time batch details, cargo manifest items, and full event histories accessible on
  mobile and handheld field devices.

### Inventory and Stock Management (`/inventory`)

- **Consumable Monitoring:** Tracking across fuel reserves, medical supplies, food rations, and technical equipment
  across all stations.
- **Life-Support Critical Tagging:** High-priority flagging for critical life-support items with visual indicators and
  priority badges.
- **Stock Threshold Alerts:** Automatic threshold detection for low and critical stock reserves.
- **Stock Adjustments & Audit Trails:** Direct stock adjustment workflows (addition/reduction) with reason logging,
  operator attribution, and transactional history.

### Emergency Response Center (`/emergency`)

- **Incident Triage & Monitoring:** Structured emergency incident logging and triage categorized by operational severity
  (Critical, High, Moderate, Low).
- **Geospatial Incident Mapping:** Incident location mapping with affected personnel records, GPS coordinates, and
  required emergency resources.
- **Incident Lifecycle Management:** Status progression workflows from reported through dispatch, on-scene response, and
  final resolution.

### Field Emergency Device Simulator (`/emergency/device/simulate`)

- **Hardware Distress Beacon Simulator:** Interactive simulator replicating polar handheld distress devices and wearable
  trackers.
- **Telemetry Simulation:** Configurable GPS coordinates, altitude, heading, battery level, charging status, and
  satellite/mesh connectivity.
- **SOS Distress Triggering:** Real-time distress signal dispatch to test emergency triage escalation and live dashboard
  alerts.

---

## Technology Stack

- **Frontend Framework:** React 19
- **Routing:** React Router v7 (`react-router-dom`)
- **Build Tool:** Vite 6 / 8
- **State Management:** Zustand
- **Styling:** Tailwind CSS v4 with bespoke polar design tokens
- **Geospatial & Mapping:** MapLibre GL
- **QR Code Scanning & Generation:** `html5-qrcode`, `qrcode.react`
- **Icons:** Lucide React
- **Design System:** Bespoke polar dark-mode theme featuring icy cyan, aurora green, solar amber, and flare red accents with monospace telemetry typography.

---

## Application Routes

| Route                        | View               | Description                                                                |
|------------------------------|--------------------|----------------------------------------------------------------------------|
| `/overview`                  | Mission Overview   | High-level metrics, active alerts, expedition & inventory snapshots        |
| `/expeditions`               | Expeditions        | Expedition planning, traverse tracking, team leader assignment             |
| `/personnel`                 | Personnel          | Base personnel roster, movement history, and personnel detail drawer       |
| `/cargo`                     | Cargo & Logistics  | Cargo indents, logistics batches, BatchMap route tracking, QR label modal  |
| `/cargo/scan`                | Cargo QR Scanner   | Live camera QR scanning, checkpoint logging, and field inspection          |
| `/inventory`                 | Inventory          | Stock monitoring, critical supply flags, adjustments, and threshold alerts |
| `/emergency`                 | Emergency Response | Incident triage, distress beacon alerts, and emergency dispatch            |
| `/emergency/device/simulate` | Device Simulator   | Polar hardware beacon simulator for SOS pings and telemetry testing        |

---

## Project Structure

```text
polar-ops-frontend/
├── public/                 # Static assets (favicons, station maps)
├── src/
│   ├── assets/             # Brand logos and visual media
│   ├── components/
│   │   ├── cargo/          # BatchMap, CargoQrModal, CargoTimeline
│   │   ├── emergency/      # Emergency map and incident components
│   │   ├── inventory/      # Inventory analytics and stock alerts
│   │   ├── layout/         # Navigation header and responsive sidebar
│   │   ├── pages/          # Primary application views (Overview, Cargo, CargoScan, etc.)
│   │   ├── personnel/      # PersonnelDrawer and roster components
│   │   └── ui/             # Reusable UI primitives (Panel, Pill, Modal, FormField, Skeleton)
│   ├── context/            # React context providers (ThemeContext)
│   ├── services/           # Axios/Fetch API client and backend service integrations
│   ├── store/              # Zustand stores (useCargoStore, useExpeditionStore, etc.)
│   ├── utils/              # Cargo helpers, status tones, and polar coordinate geo utilities
│   ├── theme.js            # Design tokens, color palette, and typography rules
│   ├── App.jsx             # Main application component, layout, and router
│   ├── main.jsx            # Application entry point
│   └── index.css           # Global stylesheets, polar scrollbars, and CSS variables
├── package.json            # Project dependencies and operational scripts
├── vercel.json             # Vercel deployment configuration & API reverse proxy rules
├── vite.config.js          # Vite build, local dev proxy, and web worker configuration
└── README.md               # Project documentation
```

---

## Getting Started

### Prerequisites

- Node.js (v18.0.0 or higher recommended)
- npm (v9.0.0 or higher) or equivalent package manager (pnpm / yarn)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/TeamOrchestrators/drishti-frontend.git
   cd drishti-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory:
   ```bash
   VITE_API_URL="http://localhost:8080"
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite development server with Hot Module Replacement (HMR) |
| `npm run build` | Compiles and bundles production-ready assets into the `dist/` directory |
| `npm run preview` | Serves the local production build for pre-deployment verification |
| `npm run lint` | Executes ESLint to validate code quality and conformance to style standards |

---

## Deployment

The application includes deployment configurations for modern static hosting platforms:

- **Vercel:** Configured via [`vercel.json`](file:///c:/Users/jaysu_84yqwhz/Projects/polar-ops-frontend/vercel.json)
  with automated API reverse proxying (`/api/*`) and SPA routing fallbacks (`/:path*` -> `/`).
- **Production Build:** `npm run build` outputs optimized production bundles with Web Worker support for MapLibre GL.

---

## License

Copyright 2026 Team Orchestrators.

This project is licensed under the Apache License, Version 2.0. You may use, modify, and distribute it in accordance with the terms of the license. See [LICENSE](LICENSE) for the full text.

SPDX identifier: `Apache-2.0`