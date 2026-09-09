# DRISHTI — Polar Operations Dashboard

**Data Reporting & Intelligent Surveillance for High-impact Tracking Interface**

A mission-critical dashboard designed for Antarctic research stations (e.g., Bharati Station) to coordinate expeditions, track station personnel, supervise cargo and resupply logistics, monitor inventory levels, and handle real-time emergency responses under extreme polar conditions.

---

## ❄️ Features

- **🌐 Mission Overview**
  - High-level status cards for active expeditions, personnel in motion, cargo in transit, and active incidents.
  - Urgent emergency alerts banner with fast-action navigation.
  - Snapshot views of active expedition readiness, critical inventory shortages, and incoming voyages.

- **🧭 Expedition Planning & Management**
  - Track active, pending, sheltered, and completed polar traverses and field research missions.
  - Create and edit expeditions with start/end schedules, routes, assigned team leads, crew sizes, and required equipment.
  - Visual status indicators and expedition readiness metrics.

- **👥 Personnel Movement & Station Roster**
  - Searchable directory of station crew and researchers across Antarctic bases.
  - Real-time tracking of personnel in motion between stations (departure, arrival, and weather-dependent statuses).
  - Assign personnel to movements and review movement history.

- **🚢 Cargo & Supply Chain Logistics**
  - Manage cargo indents with priority tagging (Critical / Standard), weight, volume, and routing.
  - Fleet visibility across polar transit vessels (icebreakers, supply ships, aircraft).
  - Assign cargo manifests to specific voyages and mark incoming shipments as received.

- **📦 Station Inventory & Stock Tracking**
  - Monitor critical station reserves (fuel, medical supplies, food rations, equipment parts).
  - Automated low-stock and critical-stock threshold alerts.
  - Fast stock adjustment modal (Add / Remove stock) with audit log / inventory change history.

- **🚨 Emergency Response Center**
  - Incident response logging system with severity categorization (Immediate Response, Extremely Critical, Critical).
  - Track affected personnel, incident locations, and required emergency resources.
  - Single-click incident resolution workflow.

---

## 🛠️ Tech Stack

- **Framework:** [React 19](https://react.dev/)
- **Build Tool:** [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Design System:** Custom polar dark-mode theme featuring icy cyan, aurora green, solar amber, and flare red accents with monospace data readouts.

---

## 📁 Project Structure

```text
polar-ops-frontend/
├── public/                 # Static assets
├── src/
│   ├── assets/             # Images and media
│   ├── components/
│   │   ├── layout/         # Header, Sidebar, navigation
│   │   ├── pages/          # Views: Overview, Expedition, Personnel, Cargo, Inventory, Emergency
│   │   └── ui/             # Reusable UI widgets: Panel, Pill, Bar, StatCard, Modal, FormField
│   ├── data/               # Mock operational data (expeditions, personnel, cargo, inventory, emergencies)
│   ├── theme.js            # Design tokens, palette, and typography definitions
│   ├── App.jsx             # Main application orchestrator and view routing
│   ├── main.jsx            # React root mount
│   └── index.css           # Global stylesheets & Tailwind setup
├── package.json            # Dependencies and npm scripts
└── vite.config.js          # Vite build configuration
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18+ or later recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/) / [pnpm](https://pnpm.io/)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-org/polar-ops-frontend.git
   cd polar-ops-frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:5173
   ```

---

## 📜 Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Starts Vite development server with Hot Module Replacement (HMR) |
| `npm run build` | Compiles and bundles production-ready assets into `dist/` |
| `npm run preview` | Locally previews the production build |
| `npm run lint` | Runs ESLint to check for code quality and style issues |

---