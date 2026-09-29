# ISDABI Frontend

Intelligent Sales Data Analysis & Business Intelligence frontend.

## Requirements

- Node.js 20+
- npm 10+
- ISDABI Backend running on `http://localhost:5000`

## Run

```powershell
npm install
npm run dev
```

If the Windows project path contains `&` and the normal npm command has a path issue, run:

```powershell
node ".\node_modules\vite\bin\vite.js" --host localhost --port 5173
```

Open `http://localhost:5173`.

## Build verification

```powershell
npm run build
```

## API contract

The frontend uses the existing ISDABI backend routes:

- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/auth/me`
- `POST /api/calls`
- `GET /api/calls`
- `GET /api/calls/:id`
- `DELETE /api/calls/:id`
- `GET /api/analytics`
- `GET /api/reports`
- `GET /api/reports/:id`
- `GET /api/health`

The UI does not contain mock sales data.
