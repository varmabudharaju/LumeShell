import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  confirmColor = 'var(--sb-red)',
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="card-3d w-[340px] p-5">
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--sb-text-primary)' }}>
          {title}
        </h3>
        <p className="text-xs mb-5" style={{ color: 'var(--sb-text-secondary)', lineHeight: 1.5 }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} title="Cancel" className="btn-3d px-3 py-1.5 text-xs rounded-md">
            Cancel
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            title={confirmLabel}
            className="btn-3d btn-3d-danger px-3 py-1.5 text-xs rounded-md"
            style={{ background: confirmColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
