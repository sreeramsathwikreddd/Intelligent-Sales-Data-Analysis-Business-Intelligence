import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function DeleteAccountCard() {
  const { user, deleteAccount } = useAuth();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user?.email === "isdabiheadanalyst@gmail.com") {
    return null;
  }

  const close = () => {
    if (loading) return;
    setOpen(false);
    setConfirmation("");
    setError("");
  };

  const removeAccount = async () => {
    if (confirmation !== "DELETE" || loading) return;

    setLoading(true);
    setError("");

    try {
      await deleteAccount();
      navigate("/login", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete your account. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <>
      <section className="account-danger-zone">
        <div>
          <span className="account-danger-eyebrow">Danger Zone</span>
          <h3>Delete account</h3>
          <p>
            Permanently delete your ISDABI account and sign out from this
            device. This action cannot be undone.
          </p>
        </div>

        <button
          type="button"
          className="account-delete-button"
          onClick={() => setOpen(true)}
        >
          Delete Account
        </button>
      </section>

      {open && (
        <div className="account-delete-overlay">
          <div
            className="account-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            aria-describedby="delete-account-description"
          >
            <span className="account-delete-icon">!</span>

            <h2 id="delete-account-title">Delete your account?</h2>

            <p id="delete-account-description">
              This will permanently remove your ISDABI account. You will not
              be able to sign in to this account again.
            </p>

            <label htmlFor="delete-confirmation">
              Type <strong>DELETE</strong> to confirm
            </label>

            <input
              id="delete-confirmation"
              className="account-delete-input"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck="false"
            />

            {error && (
              <div className="account-delete-error" role="alert">
                {error}
              </div>
            )}

            <div className="account-delete-actions">
              <button
                type="button"
                className="account-delete-cancel"
                onClick={close}
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="account-delete-confirm"
                onClick={removeAccount}
                disabled={confirmation !== "DELETE" || loading}
              >
                {loading ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
