import { motion } from 'framer-motion';
import { Brand } from './Sidebar';

const POINTS = ['Speech-to-text transcription of every call', 'Sales outcome analysis with model confidence', 'Customer intent, buying signals and objections', 'A manager report for each recording'];

/** Shared layout for Sign in and Create account. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand-top"><Brand /></div>
        <div>
          <h2>Turn every sales call into structured intelligence.</h2>
          <ul>{POINTS.map((p) => <li key={p}>{p}</li>)}</ul>
        </div>
        <span className="auth-brand-foot">Intelligent Sales Data Analysis &amp; Business Intelligence</span>
      </aside>
      <main className="auth-main">
        <motion.div className="auth-card" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
          <div className="auth-mobile-brand"><Brand /></div>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
          <p className="auth-footer">{footer}</p>
        </motion.div>
      </main>
    </div>
  );
}
