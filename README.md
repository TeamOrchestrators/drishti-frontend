# DRISHTI — Polar Operations Dashboard

**Data Reporting & Intelligent Surveillance for High-impact Tracking Interface**

A mission-critical operations dashboard engineered for Antarctic research stations (such as Bharati Station) to coordinate expeditions, track station personnel, supervise cargo and resupply logistics, monitor inventory levels, and manage real-time emergency responses in extreme polar environments.

---

## Features

### Mission Overview
- Centralized key metric indicators for active expeditions, personnel in motion, transit cargo, and open emergency incidents.
- Priority alert banner for urgent incident escalation and rapid navigation.
- Operational snapshot widgets for expedition readiness, critical inventory alerts, and incoming resupply shipments.

### Expedition Planning and Management
- Real-time tracking of planned, active, sheltered, and completed field missions and traverses.
- Comprehensive expedition creation and update workflows with schedule management, route assignment, crew allocation, and resource planning.
- Status indicators and readiness evaluations for active operations.

### Personnel Movement and Station Roster
- Searchable directory of station personnel across Antarctic research bases.
- Real-time monitoring of personnel movements between stations with departure, arrival, and weather-dependent condition updates.
- Expedition assignment workflow and historical movement audit logging.

### Cargo and Logistics
- Indent prioritization (Critical / Standard) with weight, volume, and route tracking.
- Transport vessel coordination covering icebreakers, supply vessels, and polar transport aircraft.
- Manifest assignment to logistics batches and delivery verification.

### Inventory and Stock Management
- Critical consumable monitoring across fuel reserves, medical supplies, food rations, and technical equipment.
- Threshold alerts for critical and low stock levels.
- Direct stock adjustment capabilities (addition/reduction) with audit logging and transactional history.

### Emergency Response Center
- Structured incident reporting and triage categorized by operational severity.
- Incident tracking with affected personnel records, GPS coordinates, and required emergency resources.
- Direct incident lifecycle management and resolution workflows.

---

## Technology Stack

- **Frontend Framework:** React 19
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Design System:** Bespoke polar dark-mode theme featuring icy cyan, aurora green, solar amber, and flare red accents with monospace telemetry typography.

---

## Project Structure

```text
polar-ops-frontend/
├── public/                 # Static assets
├── src/
│   ├── assets/             # Images and visual media
│   ├── components/
│   │   ├── emergency/      # Emergency map and incident components
│   │   ├── inventory/      # Inventory analytics and stock alerts
│   │   ├── layout/         # Navigation header and sidebar
│   │   ├── pages/          # Primary application views
│   │   └── ui/             # Reusable UI primitives (Panel, Pill, Modal, FormField, etc.)
│   ├── services/           # API client and backend service integrations
│   ├── store/              # Zustand state management stores
│   ├── theme.js            # Design tokens, color palette, and typography rules
│   ├── App.jsx             # Main application component and view router
│   ├── main.jsx            # Application entry point
│   └── index.css           # Global stylesheets and CSS variables
├── package.json            # Project dependencies and operational scripts
├── vite.config.js          # Vite build and proxy configuration
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
   Create a `.env` file in the root directory (or copy from `.env.example`):
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

## License

Copyright 2026 Team Orchestrators.

This project is licensed under the Apache License, Version 2.0. You may use, modify, and distribute it in accordance with the terms of the license. See [LICENSE](LICENSE) for the full text.

SPDX identifier: `Apache-2.0`
 