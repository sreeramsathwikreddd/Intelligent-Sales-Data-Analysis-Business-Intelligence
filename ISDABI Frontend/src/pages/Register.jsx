import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import AuthShell from "../components/AuthShell";
import Button from "../components/Button";
import Icon from "../components/Icon";
import GoogleRoleDialog from "../components/GoogleRoleDialog";
import { friendlyError } from "../utils/errors";
import { initializeGoogle, renderGoogleButton } from "../utils/googleAuth";
import "./Auth.css";

export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("analyst");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleCredential, setGoogleCredential] = useState("");
  const [googleProfile, setGoogleProfile] = useState(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);

  useEffect(() => {
    let active = true;

    initializeGoogle(async (response) => {
      if (!response?.credential || !active) return;

      setGoogleLoading(true);
      setError("");

      try {
        const result = await googleLogin(response.credential);

        if (result?.requiresRole) {
          setGoogleCredential(response.credential);
          setGoogleProfile(result.googleUser);
          setRoleDialogOpen(true);
          return;
        }

        navigate("/");
      } catch (err) {
        console.error("[ISDABI] Google registration failed:", err);
        setError(
          err.response?.data?.message ||
          friendlyError(err, "Unable to register with Google")
        );
      } finally {
        if (active) setGoogleLoading(false);
      }
    })
      .then(() => {
        if (!active || !googleButtonRef.current) return;

        renderGoogleButton(googleButtonRef.current);
        setGoogleReady(true);
      })
      .catch((err) => {
        console.error("[ISDABI] Google initialization failed:", err);
        if (active) setError(err.message);
      });

    return () => {
      active = false;

      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = "";
      }
    };
  }, [googleLogin, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();

    if (loading) return;

    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, role);
      navigate("/");
    } catch (err) {
      console.error("[ISDABI] Registration failed:", err);
      setError(
        err.response?.data?.message ||
        friendlyError(err, "Unable to register")
      );
    } finally {
      setLoading(false);
    }
  };

  const completeGoogleRegistration = async (selectedRole) => {
    if (!googleCredential || googleLoading) return;

    setGoogleLoading(true);
    setError("");

    try {
      await googleLogin(googleCredential, selectedRole);
      setRoleDialogOpen(false);
      setGoogleCredential("");
      setGoogleProfile(null);
      navigate("/");
    } catch (err) {
      console.error("[ISDABI] Google account creation failed:", err);
      setError(
        err.response?.data?.message ||
        friendlyError(err, "Unable to create your Google account")
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  const cancelGoogleRegistration = () => {
    setRoleDialogOpen(false);
    setGoogleCredential("");
    setGoogleProfile(null);
    setGoogleLoading(false);
  };

  return (
    <>
      <AuthShell
        title="Create account"
        subtitle="Start turning sales calls into intelligence."
        footer={
          <>
            Already have an account? <Link to="/login">Sign in</Link>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate={false}>
          <label className="label" htmlFor="name">
            Name
          </label>

          <input
            id="name"
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            autoFocus
          />

          <label className="label" htmlFor="email" style={{ marginTop: 16 }}>
            Email
          </label>

          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <label className="label" htmlFor="password" style={{ marginTop: 16 }}>
            Password (min 8)
          </label>

          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />

          <label className="label" htmlFor="role" style={{ marginTop: 16 }}>
            Role
          </label>

          <select
            id="role"
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="analyst">Analyst</option>
            <option value="sales_representative">
              Sales Representative
            </option>
          </select>

          {error && (
            <div className="notice notice-error auth-error" role="alert">
              <Icon name="alert" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="auth-btn"
            loading={loading}
            loadingLabel="Creating account..."
          >
            Create account
          </Button>
        </form>

        <div className="auth-google-shell">
          <button type="button" className="auth-google-btn" tabIndex={-1}>
            <span className="auth-google-icon">G</span>
            <span>Continue with Google</span>
          </button>

          <div
            ref={googleButtonRef}
            className="auth-google-official"
            aria-hidden="true"
          />
        </div>

        {!googleReady && (
          <div className="auth-google-loading">
            Loading Google sign in...
          </div>
        )}

        {googleLoading && !roleDialogOpen && (
          <div className="auth-google-loading">
            Connecting with Google...
          </div>
        )}
      </AuthShell>

      <GoogleRoleDialog
        open={roleDialogOpen}
        name={googleProfile?.name}
        email={googleProfile?.email}
        initialRole={role}
        loading={googleLoading}
        onContinue={completeGoogleRegistration}
        onCancel={cancelGoogleRegistration}
      />
    </>
  );
}
