import React from 'react';
import { useLibrary } from '../context/LibraryContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useLibrary();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      pointerEvents: 'none'
    }}>
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className="animate-slide-up"
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 18px',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              boxShadow: 'var(--shadow-lg)',
              minWidth: '280px',
              maxWidth: '420px',
              backdropFilter: 'blur(12px)'
            }}
          >
            {isSuccess && <CheckCircle2 size={18} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />}
            {isError && <AlertCircle size={18} style={{ color: 'var(--text-primary)', flexShrink: 0 }} />}
            {!isSuccess && !isError && <Info size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}

            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
              {toast.message}
            </p>

            <button
              onClick={() => removeToast(toast.id)}
              style={{
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                borderRadius: '4px'
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
