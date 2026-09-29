# ISDABI Frontend — Completed Redesign Package

## What is included

This ZIP is the complete frontend project package for the redesigned ISDABI UI.

### Core project files
- `package.json` — restored project dependencies and scripts.
- `vite.config.js` — Vite + React config, including `/api` proxy to `http://localhost:5000`.
- `index.html` — frontend entry HTML.
- `src/main.jsx` — React entry point and BrowserRouter setup.
- `.gitignore` — excludes dependencies, build output and local environment files.

### Authentication
- `src/hooks/useAuth.jsx` — restored authentication context, login, registration, session restore and logout.

### Backend/API integration
- `src/services/api.js` — restored Axios API service for auth, calls, analytics, reports and health.
- `src/utils/ids.js` — protects call routes from invalid IDs such as `undefined` and `null`.

### Analysis/upload flow
- `src/pages/Analyze.jsx` — preserved the redesigned upload and processing UI; accepted audio formats now match the current backend schema: WAV, MP3, M4A, FLAC, OGG and WEBM.
- `src/pages/CallDetail.jsx` — uses validated call IDs before requesting `/api/calls/:id` and supports completed/processing/failed states.
- `src/components/ProcessingTimeline.jsx` — visual processing timeline without inventing backend stages.

### Dashboard/history/report UI
- `src/pages/Dashboard.jsx`
- `src/pages/History.jsx`
- `src/pages/AnalyticsPage.jsx`
- `src/pages/Reports.jsx`
- `src/pages/Settings.jsx`
- `src/components/CallCard.jsx`
- `src/components/ReportCard.jsx`
- `src/components/ManagerReport.jsx`
- `src/components/Charts.jsx`
- all supporting UI components, hooks, utilities and CSS files from the supplied redesign.

## Important integration rules preserved

1. No mock sales data was added.
2. Existing backend routes are used.
3. Existing authentication storage keys are preserved:
   - `isdabi_token`
   - `isdabi_user`
4. Call upload uses multipart field `audio`, matching the backend route.
5. Call detail requests are blocked when the ID is invalid, preventing `/api/calls/undefined`.
6. Model confidence is displayed as model confidence, not as a guaranteed real-world probability.
7. Existing AI pipeline, MongoDB and backend behavior are not included in this frontend ZIP and are not modified by this package.

## Files intentionally NOT included

- `node_modules/`
- `dist/`
- `.env`
- backend source
- AI/ML source
- datasets
- model weights
- audio recordings

These are intentionally excluded so the ZIP remains a clean frontend source package.

## Local setup

```powershell
cd "A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence\ISDABI Frontend"
npm install
npm run dev
```

If the Windows path causes the normal Vite launcher to fail because of `&`, use:

```powershell
node ".\node_modules\vite\bin\vite.js" --host localhost --port 5173
```

## Build check

Run:

```powershell
npm run build
```

The source package was checked for unresolved relative imports. All relative imports resolve inside this package.
