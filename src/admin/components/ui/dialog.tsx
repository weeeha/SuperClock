import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="admin-root fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative max-h-[85vh] w-full max-w-md overflow-auto rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 shadow-xl',
          className,
        )}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <header className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="rounded-md p-1 opacity-60 hover:opacity-100 hover:bg-[hsl(var(--muted))]"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
