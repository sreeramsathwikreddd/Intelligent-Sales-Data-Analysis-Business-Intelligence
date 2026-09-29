$ErrorActionPreference = "Stop"

$root = "A:\5.Projects & Information\16.Intelligent Sales Data Analysis & Business Intelligence"

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " ISDABI HEAD ANALYST MANAGEMENT SETUP" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $root

# --------------------------------------------------
# PATHS
# --------------------------------------------------

$frontend = Join-Path $root "ISDABI Frontend"
$backend = Join-Path $root "ISDABI Backend"

$sidebarFile = Join-Path $frontend "src\components\Sidebar.jsx"
$appFile = Join-Path $frontend "src\App.jsx"
$apiFile = Join-Path $frontend "src\services\api.js"
$serverFile = Join-Path $backend "ISDABI Backend Server.js"

$controllerFile = Join-Path $backend "controllers\ISDABI User Management Controller.js"
$routesFile = Join-Path $backend "routes\ISDABI User Management Routes.js"

$managementPage = Join-Path $frontend "src\pages\ManageUsers.jsx"
$managementCss = Join-Path $frontend "src\pages\ManageUsers.css"

# --------------------------------------------------
# VERIFY EXISTING FILES
# --------------------------------------------------

Write-Host "[1/9] Checking existing project files..." -ForegroundColor Yellow

$requiredFiles = @(
    $sidebarFile,
    $appFile,
    $apiFile,
    $serverFile
)

foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        throw "Required file not found: $file"
    }
}

Write-Host "      Existing files verified." -ForegroundColor Green

# --------------------------------------------------
# BACKUP
# --------------------------------------------------

Write-Host "[2/9] Creating backup..." -ForegroundColor Yellow

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = Join-Path $root ".ISDABI_HeadAnalyst_Backup_$stamp"

New-Item -ItemType Directory -Path $backup -Force | Out-Null

Copy-Item $sidebarFile (Join-Path $backup "Sidebar.jsx.backup")
Copy-Item $appFile (Join-Path $backup "App.jsx.backup")
Copy-Item $apiFile (Join-Path $backup "api.js.backup")
Copy-Item $serverFile (Join-Path $backup "ISDABI Backend Server.js.backup")

Write-Host "      Backup created:" -ForegroundColor Green
Write-Host "      $backup" -ForegroundColor Green

# --------------------------------------------------
# BACKEND CONTROLLER
# --------------------------------------------------

Write-Host "[3/9] Creating user-management backend..." -ForegroundColor Yellow

@"
const User = require("../models/ISDABI User");

const publicManagedUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  authProvider: user.authProvider,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt
});

const listUsers = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "head_analyst") {
      return res.status(403).json({
        success: false,
        message: "Only the Head Analyst can manage users."
      });
    }

    const role = req.params.role;

    if (!["analyst", "sales_representative"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid managed user role."
      });
    }

    const users = await User.find({ role })
      .select("-passwordHash -googleId")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      users: users.map(publicManagedUser)
    });
  } catch (error) {
    console.error("[ISDABI] List managed users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load users."
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "head_analyst") {
      return res.status(403).json({
        success: false,
        message: "Only the Head Analyst can manage users."
      });
    }

    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false."
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (user.role === "head_analyst") {
      return res.status(403).json({
        success: false,
        message: "The Head Analyst account cannot be modified here."
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot modify your own account here."
      });
    }

    user.isActive = isActive;

    await user.save();

    return res.json({
      success: true,
      message: isActive
        ? "User enabled successfully."
        : "User disabled successfully.",
      user: publicManagedUser(user)
    });
  } catch (error) {
    console.error("[ISDABI] Update managed user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update user status."
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    if (!req.user || req.user.role !== "head_analyst") {
      return res.status(403).json({
        success: false,
        message: "Only the Head Analyst can manage users."
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    if (user.role === "head_analyst") {
      return res.status(403).json({
        success: false,
        message: "The Head Analyst account cannot be deleted here."
      });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own account here."
      });
    }

    await User.findByIdAndDelete(user._id);

    return res.json({
      success: true,
      message: "User deleted successfully."
    });
  } catch (error) {
    console.error("[ISDABI] Delete managed user error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete user."
    });
  }
};

module.exports = {
  listUsers,
  updateUserStatus,
  deleteUser
};
"@ | Set-Content -Encoding UTF8 $controllerFile

# --------------------------------------------------
# BACKEND ROUTES
# --------------------------------------------------

@"
const express = require("express");
const { protect, allowRoles } = require("../middleware/ISDABI Auth Middleware");

const {
  listUsers,
  updateUserStatus,
  deleteUser
} = require("../controllers/ISDABI User Management Controller");

const router = express.Router();

router.use(protect, allowRoles("head_analyst"));

router.get("/:role", listUsers);
router.patch("/:id/status", updateUserStatus);
router.delete("/:id", deleteUser);

module.exports = router;
"@ | Set-Content -Encoding UTF8 $routesFile

# --------------------------------------------------
# BACKEND SERVER PATCH
# --------------------------------------------------

$server = Get-Content $serverFile -Raw

if ($server -notmatch "ISDABI User Management Routes") {

    if ($server -notmatch 'const authRoutes=require\("\./routes/ISDABI Auth Routes"\);') {
        throw "Could not find authentication route import in backend server."
    }

    if ($server -notmatch 'app\.use\("/api/auth",authRoutes\);') {
        throw "Could not find authentication route mount in backend server."
    }

    $server = $server.Replace(
        'const authRoutes=require("./routes/ISDABI Auth Routes");',
        'const authRoutes=require("./routes/ISDABI Auth Routes");' + "`r`n" +
        'const userManagementRoutes=require("./routes/ISDABI User Management Routes");'
    )

    $server = $server.Replace(
        'app.use("/api/auth",authRoutes);',
        'app.use("/api/auth",authRoutes);' + "`r`n" +
        'app.use("/api/user-management",userManagementRoutes);'
    )

    Set-Content -Encoding UTF8 $serverFile $server
}

Write-Host "      Backend management API added." -ForegroundColor Green

# --------------------------------------------------
# FRONTEND API
# --------------------------------------------------

Write-Host "[4/9] Adding frontend management API..." -ForegroundColor Yellow

$api = Get-Content $apiFile -Raw

if ($api -notmatch "userManagement") {

    $managementApi = @"
export const userManagement = {
  list: (role) =>
    api.get(`/user-management/${role}`),

  setStatus: (id, isActive) =>
    api.patch(`/user-management/${id}/status`, { isActive }),

  delete: (id) =>
    api.delete(`/user-management/${id}`)
};

"@

    $api = $api.Replace(
        "export const health = () =>",
        $managementApi + "export const health = () =>"
    )

    Set-Content -Encoding UTF8 $apiFile $api
}

Write-Host "      Frontend API added." -ForegroundColor Green

# --------------------------------------------------
# SIDEBAR
# --------------------------------------------------

Write-Host "[5/9] Updating Head Analyst sidebar..." -ForegroundColor Yellow

$sidebar = Get-Content $sidebarFile -Raw

if ($sidebar -notmatch "manage-analysts") {

    $reportsLine = "  { to: '/reports', label: 'Reports', icon: 'reports' },"

    if ($sidebar -notmatch [regex]::Escape($reportsLine)) {
        throw "Reports navigation item was not found. Sidebar was not modified."
    }

    $newItems = @"
  { to: '/reports', label: 'Reports', icon: 'reports' },
  { to: '/manage-analysts', label: 'Manage Analysts', icon: 'history', headAnalystOnly: true },
  { to: '/manage-sales-representatives', label: 'Manage Sales Representatives', icon: 'analytics', headAnalystOnly: true },
"@

    $sidebar = $sidebar.Replace(
        $reportsLine,
        $newItems.TrimEnd()
    )

    $sidebarMap = "{NAV_ITEMS.map((item) => ("
    $filteredMap = "{NAV_ITEMS.filter((item) => !item.headAnalystOnly || user?.role === 'head_analyst').map((item) => ("

    if ($sidebar -notmatch [regex]::Escape($sidebarMap)) {
        throw "Sidebar navigation map was not found. Sidebar was not modified."
    }

    $sidebar = $sidebar.Replace($sidebarMap, $filteredMap)

    Set-Content -Encoding UTF8 $sidebarFile $sidebar
}

Write-Host "      Sidebar updated." -ForegroundColor Green

# --------------------------------------------------
# MANAGE USERS PAGE
# --------------------------------------------------

Write-Host "[6/9] Creating management page..." -ForegroundColor Yellow

@"
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { userManagement } from "../services/api";
import "./ManageUsers.css";

const ROLE_CONFIG = {
  analyst: {
    title: "Manage Analysts",
    subtitle: "Manage analyst accounts and access.",
    empty: "No analyst accounts found."
  },
  sales_representative: {
    title: "Manage Sales Representatives",
    subtitle: "Manage sales representative accounts and access.",
    empty: "No sales representative accounts found."
  }
};

function formatDate(value) {
  if (!value) return "Never";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

export default function ManageUsers({ role }) {
  const { user } = useAuth();

  const config = ROLE_CONFIG[role];

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await userManagement.list(role);
      setUsers(response.data?.users || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to load users."
      );
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (user?.role === "head_analyst") {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [user?.role, loadUsers]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return users;
    }

    return users.filter((item) =>
      [item.name, item.email, item.authProvider]
        .filter(Boolean)
        .some((value) =>
          value.toLowerCase().includes(query)
        )
    );
  }, [users, search]);

  const toggleStatus = async (item) => {
    setWorkingId(item.id);
    setError("");
    setMessage("");

    try {
      const response = await userManagement.setStatus(
        item.id,
        !item.isActive
      );

      const updated = response.data?.user;

      setUsers((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, ...updated }
            : entry
        )
      );

      setMessage(
        response.data?.message ||
        "User status updated."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to update user status."
      );
    } finally {
      setWorkingId("");
    }
  };

  const removeUser = async (item) => {
    const confirmed = window.confirm(
      `Delete ${item.name || item.email} permanently?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setWorkingId(item.id);
    setError("");
    setMessage("");

    try {
      const response = await userManagement.delete(item.id);

      setUsers((current) =>
        current.filter((entry) => entry.id !== item.id)
      );

      setMessage(
        response.data?.message ||
        "User deleted successfully."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete user."
      );
    } finally {
      setWorkingId("");
    }
  };

  if (user?.role !== "head_analyst") {
    return (
      <section className="manage-users-page">
        <div className="manage-users-card manage-users-denied">
          <h1>Access denied</h1>
          <p>Only the Head Analyst can manage users.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="manage-users-page">

      <div className="manage-users-header">

        <div>
          <span className="manage-users-eyebrow">
            HEAD ANALYST
          </span>

          <h1>{config.title}</h1>

          <p>{config.subtitle}</p>
        </div>

        <button
          type="button"
          className="manage-users-refresh"
          onClick={loadUsers}
          disabled={loading || Boolean(workingId)}
        >
          Refresh
        </button>

      </div>

      <div className="manage-users-toolbar">

        <div className="manage-users-count">
          <strong>{users.length}</strong>
          <span>Total accounts</span>
        </div>

        <input
          className="manage-users-search"
          type="search"
          placeholder="Search by name, email or provider..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
        />

      </div>

      {message && (
        <div className="manage-users-message success">
          {message}
        </div>
      )}

      {error && (
        <div className="manage-users-message error">
          {error}
        </div>
      )}

      <div className="manage-users-card">

        {loading ? (
          <div className="manage-users-state">
            Loading users...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="manage-users-state">
            {config.empty}
          </div>
        ) : (

          <div className="manage-users-table-wrap">

            <table className="manage-users-table">

              <thead>
                <tr>
                  <th>User</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>

                {filteredUsers.map((item) => {

                  const busy = workingId === item.id;

                  const initial = (
                    item.name ||
                    item.email ||
                    "U"
                  )
                    .trim()
                    .charAt(0)
                    .toUpperCase();

                  return (
                    <tr key={item.id}>

                      <td>

                        <div className="manage-users-person">

                          <span className="manage-users-avatar">
                            {initial}
                          </span>

                          <span>
                            <strong>
                              {item.name || "Unnamed User"}
                            </strong>

                            <small>
                              {item.email}
                            </small>
                          </span>

                        </div>

                      </td>

                      <td>
                        <span className="manage-users-provider">
                          {item.authProvider === "google"
                            ? "Google"
                            : "Password"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`manage-users-status ${
                            item.isActive
                              ? "active"
                              : "inactive"
                          }`}
                        >
                          {item.isActive
                            ? "Active"
                            : "Disabled"}
                        </span>
                      </td>

                      <td>
                        {formatDate(item.lastLoginAt)}
                      </td>

                      <td>

                        <div className="manage-users-actions">

                          <button
                            type="button"
                            className="manage-users-action"
                            disabled={busy}
                            onClick={() =>
                              toggleStatus(item)
                            }
                          >
                            {busy
                              ? "Working..."
                              : item.isActive
                                ? "Disable"
                                : "Enable"}
                          </button>

                          <button
                            type="button"
                            className="manage-users-action danger"
                            disabled={busy}
                            onClick={() =>
                              removeUser(item)
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>
                  );
                })}

              </tbody>

            </table>

          </div>

        )}

      </div>

    </section>
  );
}
"@ | Set-Content -Encoding UTF8 $managementPage

# --------------------------------------------------
# MANAGEMENT CSS
# --------------------------------------------------

@"
.manage-users-page {
  width: 100%;
  min-width: 0;
  padding: 4px 0 28px;
}

.manage-users-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.manage-users-eyebrow {
  display: block;
  font-size: 11px;
  letter-spacing: .16em;
  font-weight: 800;
  opacity: .62;
  margin-bottom: 7px;
}

.manage-users-header h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.15;
}

.manage-users-header p {
  margin: 8px 0 0;
  opacity: .62;
  font-size: 14px;
}

.manage-users-refresh,
.manage-users-action {
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.045);
  color: inherit;
  border-radius: 10px;
  padding: 10px 15px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: .2s;
}

.manage-users-refresh:hover,
.manage-users-action:hover {
  background: rgba(255,255,255,.09);
}

.manage-users-refresh:disabled,
.manage-users-action:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.manage-users-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.manage-users-count {
  display: flex;
  align-items: baseline;
  gap: 9px;
}

.manage-users-count strong {
  font-size: 24px;
}

.manage-users-count span {
  font-size: 13px;
  opacity: .58;
}

.manage-users-search {
  width: min(360px,100%);
  border: 1px solid rgba(255,255,255,.12);
  background: rgba(255,255,255,.045);
  color: inherit;
  border-radius: 10px;
  padding: 11px 13px;
  outline: none;
  font: inherit;
  font-size: 13px;
}

.manage-users-search:focus {
  border-color: rgba(0,210,255,.55);
  box-shadow: 0 0 0 3px rgba(0,210,255,.08);
}

.manage-users-card {
  border: 1px solid rgba(255,255,255,.09);
  background: rgba(255,255,255,.035);
  border-radius: 16px;
  overflow: hidden;
}

.manage-users-message {
  padding: 11px 14px;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 13px;
}

.manage-users-message.success {
  background: rgba(0,220,170,.08);
  border: 1px solid rgba(0,220,170,.18);
}

.manage-users-message.error {
  background: rgba(255,80,100,.08);
  border: 1px solid rgba(255,80,100,.18);
}

.manage-users-table-wrap {
  overflow: auto;
}

.manage-users-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 820px;
}

.manage-users-table th {
  padding: 14px 16px;
  text-align: left;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .08em;
  opacity: .52;
  font-weight: 800;
  border-bottom: 1px solid rgba(255,255,255,.08);
}

.manage-users-table td {
  padding: 15px 16px;
  border-bottom: 1px solid rgba(255,255,255,.06);
  font-size: 13px;
  vertical-align: middle;
}

.manage-users-table tbody tr:last-child td {
  border-bottom: 0;
}

.manage-users-person {
  display: flex;
  align-items: center;
  gap: 11px;
}

.manage-users-person > span:last-child {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.manage-users-person strong {
  font-size: 13px;
}

.manage-users-person small {
  opacity: .55;
  font-size: 11px;
}

.manage-users-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(0,210,255,.1);
  border: 1px solid rgba(0,210,255,.18);
  font-weight: 800;
}

.manage-users-provider {
  font-size: 12px;
  opacity: .7;
}

.manage-users-status {
  display: inline-flex;
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
}

.manage-users-status.active {
  background: rgba(0,220,170,.1);
  color: #72f5d0;
}

.manage-users-status.inactive {
  background: rgba(255,160,70,.1);
  color: #ffc07a;
}

.manage-users-actions {
  display: flex;
  gap: 7px;
}

.manage-users-action.danger {
  border-color: rgba(255,80,100,.2);
}

.manage-users-action.danger:hover {
  background: rgba(255,80,100,.1);
}

.manage-users-state {
  padding: 50px 20px;
  text-align: center;
  opacity: .58;
  font-size: 14px;
}

.manage-users-denied {
  padding: 50px 25px;
}

.manage-users-denied h1 {
  margin: 0 0 8px;
}

.manage-users-denied p {
  margin: 0;
  opacity: .6;
}

@media (max-width:760px) {
  .manage-users-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .manage-users-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .manage-users-search {
    width: 100%;
  }
}
"@ | Set-Content -Encoding UTF8 $managementCss

Write-Host "      Management page created." -ForegroundColor Green

# --------------------------------------------------
# APP ROUTES
# --------------------------------------------------

Write-Host "[7/9] Adding protected routes..." -ForegroundColor Yellow

$app = Get-Content $appFile -Raw

if ($app -notmatch "ManageUsers") {

    $app = $app.Replace(
        "  Settings: () => import('./pages/Settings'),",
        "  Settings: () => import('./pages/Settings'),`r`n  ManageUsers: () => import('./pages/ManageUsers'),"
    )

    $app = $app.Replace(
        "const Settings = lazy(loaders.Settings);",
        "const Settings = lazy(loaders.Settings);`r`nconst ManageUsers = lazy(loaders.ManageUsers);"
    )

    $headAnalystGuard = @"
function HeadAnalystRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Splash />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return user?.role === "head_analyst"
    ? children
    : <Navigate to="/" replace />;
}

"@

    $app = $app.Replace(
        "function PublicOnly({ children }) {",
        $headAnalystGuard + "function PublicOnly({ children }) {"
    )

    $settingsRoute = '                <Route path="settings" element={<Settings />} />'

    if ($app -notmatch [regex]::Escape($settingsRoute)) {
        throw "Settings route was not found. App routes were not modified."
    }

    $managementRoutes = @"
$settingsRoute
                <Route
                  path="manage-analysts"
                  element={
                    <HeadAnalystRoute>
                      <ManageUsers role="analyst" />
                    </HeadAnalystRoute>
                  }
                />
                <Route
                  path="manage-sales-representatives"
                  element={
                    <HeadAnalystRoute>
                      <ManageUsers role="sales_representative" />
                    </HeadAnalystRoute>
                  }
                />
"@

    $app = $app.Replace(
        $settingsRoute,
        $managementRoutes.TrimEnd()
    )

    Set-Content -Encoding UTF8 $appFile $app
}

Write-Host "      Protected routes added." -ForegroundColor Green

# --------------------------------------------------
# BACKEND VERIFICATION
# --------------------------------------------------

Write-Host "[8/9] Verifying backend..." -ForegroundColor Yellow

Set-Location $backend

node -e "require('./controllers/ISDABI User Management Controller'); require('./routes/ISDABI User Management Routes'); console.log('[ISDABI] User management backend modules verified successfully.');"

if ($LASTEXITCODE -ne 0) {
    throw "Backend verification failed."
}

Write-Host "      Backend verification successful." -ForegroundColor Green

# --------------------------------------------------
# FRONTEND BUILD
# --------------------------------------------------

Write-Host "[9/9] Building frontend..." -ForegroundColor Yellow

Set-Location $frontend

node ".\node_modules\vite\bin\vite.js" build

if ($LASTEXITCODE -ne 0) {
    throw "Frontend build failed."
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " ISDABI HEAD ANALYST MANAGEMENT READY" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Added:" -ForegroundColor Cyan
Write-Host "  Manage Analysts" -ForegroundColor White
Write-Host "  Manage Sales Representatives" -ForegroundColor White
Write-Host ""
Write-Host "Features:" -ForegroundColor Cyan
Write-Host "  Search users" -ForegroundColor White
Write-Host "  Enable / Disable users" -ForegroundColor White
Write-Host "  Delete users" -ForegroundColor White
Write-Host "  Backend Head Analyst RBAC" -ForegroundColor White
Write-Host "  Protected frontend routes" -ForegroundColor White
Write-Host ""
Write-Host "Existing features remain unchanged." -ForegroundColor Green
Write-Host ""
Write-Host "Backup:" -ForegroundColor Yellow
Write-Host $backup -ForegroundColor Yellow
Write-Host ""
