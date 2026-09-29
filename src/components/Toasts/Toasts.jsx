import { LineIcon } from '../../utils/fileIcons';
import './Toasts.css';

const ICONS = { success: 'check', error: 'alert', info: 'info' };

function Toasts({ toasts, onDismiss }) {
    return (
        <div className="toasts" role="status" aria-live="polite">
            {toasts.map((toast) => (
                <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : undefined}>
                    <span className="toast-icon"><LineIcon name={ICONS[toast.type] || 'info'} size={13} strokeWidth={2.4} /></span>
                    <span className="toast-message">{toast.message}</span>
                    <button className="toast-close" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
                        <LineIcon name="close" size={12} strokeWidth={2.4} />
                    </button>
                </div>
            ))}
        </div>
    );
}

export default Toasts;
