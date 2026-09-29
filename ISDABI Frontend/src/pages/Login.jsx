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

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [googleReady, setGoogleReady] = useState(false);
  const [loading, setLoading] = useState(false);
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
        console.error("[ISDABI] Google sign in failed:", err);
        setError(
          err.response?.data?.message ||
          friendlyError(err, "Unable to sign in with Google")
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
    setLoading(true);

    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      console.error("[ISDABI] Sign in failed:", err);
      setError(
        err.response?.status === 401
          ? err.response?.data?.message || "Incorrect email or password."
          : friendlyError(err, "Unable to sign in")
      );
    } finally {
      setLoading(false);
    }
  };

  const completeGoogleRegistration = async (role) => {
    if (!googleCredential || googleLoading) return;

    setGoogleLoading(true);
    setError("");

    try {
      await googleLogin(googleCredential, role);
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
        title="Sign in"
        subtitle="Welcome back to ISDABI Sales Intelligence."
        footer={
          <>
            No account? <Link to="/register">Create one</Link>
          </>
        }
      >
        <form onSubmit={onSubmit} noValidate={false}>
          <label className="label" htmlFor="email">
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
            autoFocus
          />

          <label
            className="label"
            htmlFor="password"
            style={{ marginTop: 16 }}
          >
            Password
          </label>

          <input
            id="password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

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
            loadingLabel="Signing in..."
          >
            Sign in
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
            Signing in with Google...
          </div>
        )}
      </AuthShell>

      <GoogleRoleDialog
        open={roleDialogOpen}
        name={googleProfile?.name}
        email={googleProfile?.email}
        loading={googleLoading}
        onContinue={completeGoogleRegistration}
        onCancel={cancelGoogleRegistration}
      />
    </>
  );
}
