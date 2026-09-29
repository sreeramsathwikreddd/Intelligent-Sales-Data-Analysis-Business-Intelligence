import { useEffect, useRef, useState } from 'react';
import Button from './Button';
import { useToast } from './Toast';

export default function CopyButton({ getText, children, doneLabel = 'Copied', toastMessage, variant = 'secondary', size = 'sm', icon = 'copy', disabled }) {
  const [done, setDone] = useState(false);
  const timer = useRef(null);
  const toast = useToast();
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      setDone(true);
      if (toastMessage) toast.success(toastMessage);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 1800);
    } catch (err) {
      console.error('[ISDABI] Copy failed:', err);
      toast.error('Copy is not available in this browser.');
    }
  };
  return <Button variant={variant} size={size} icon={icon} done={done} doneLabel={doneLabel} onClick={copy} disabled={disabled}>{children}</Button>;
}
