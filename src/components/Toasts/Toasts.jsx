import './Toasts.css';

function Toasts({ toasts, onDismiss }) {
    return (
        <div className="toasts" role="status" aria-live="polite">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : undefined}>
                    <span className="toast-message">{toast.message}</span>
                    <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">✕</button>
                </div>
            ))}
        </div>
    );
}

export default Toasts;
