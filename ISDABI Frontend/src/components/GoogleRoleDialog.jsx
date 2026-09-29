import { useEffect, useRef, useState } from 'react';

export default function GoogleRoleDialog({
  open,
  name,
  email,
  initialRole = 'analyst',
  loading = false,
  onContinue,
  onCancel
}) {
  const [role, setRole] = useState(initialRole);
  const firstButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    setRole(initialRole);

    const timer = setTimeout(() => {
      firstButtonRef.current?.focus();
    }, 0);

    return () => clearTimeout(timer);
  }, [open, initialRole]);

  if (!open) return null;

  return (
    <div
      className="google-role-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-role-title"
      aria-describedby="google-role-description"
    >
      <div className="google-role-dialog">
        <div className="google-role-mark">ISDABI</div>

        <h2 id="google-role-title">Choose your ISDABI role</h2>

        <p id="google-role-description">
          Your Google account is verified. Select the role you want to use for
          your ISDABI account.
        </p>

        <div className="google-role-account">
          <strong>{name || 'Google User'}</strong>
          <span>{email}</span>
        </div>

        <div className="google-role-options">
          <button
            ref={firstButtonRef}
            type="button"
            className={`google-role-option ${role === 'analyst' ? 'selected' : ''}`}
            onClick={() => setRole('analyst')}
          >
            <span className="google-role-option-title">Analyst</span>
            <span className="google-role-option-text">
              Sales intelligence, analysis and reporting.
            </span>
          </button>

          <button
            type="button"
            className={`google-role-option ${role === 'sales_representative' ? 'selected' : ''}`}
            onClick={() => setRole('sales_representative')}
          >
            <span className="google-role-option-title">
              Sales Representative
            </span>
            <span className="google-role-option-text">
              Sales calls, customer conversations and follow-up.
            </span>
          </button>
        </div>

        <div className="google-role-actions">
          <button
            type="button"
            className="google-role-cancel"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="google-role-continue"
            onClick={() => onContinue(role)}
            disabled={loading}
          >
            {loading ? 'Creating account...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
