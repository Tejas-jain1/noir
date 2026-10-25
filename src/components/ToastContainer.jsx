import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useLibrary();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container-root">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className="toast-item animate-slide-up"
          >
            {isSuccess && <CheckCircle2 size={18} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />}
            {isError && <AlertCircle size={18} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />}
            {!isSuccess && !isError && <Info size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}

            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500, flex: 1, lineHeight: 1.4, wordBreak: 'break-word' }}>
              {toast.message}
            </p>

            <button
              onClick={() => removeToast(toast.id)}
              style={{
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '4px',
                flexShrink: 0
              }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
