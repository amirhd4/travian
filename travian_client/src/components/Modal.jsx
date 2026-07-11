import { useEffect } from 'react';

export function Modal({ open, onClose, title, icon, children, size = 'md' }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

    return (
        <div
            className="fixed inset-0 bg-ink-900/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4"
            onClick={onClose}
        >
            <div
                className={`panel w-full ${widths[size]} p-6 relative animate-[fadeIn_.15s_ease-out]`}
                onClick={(e) => e.stopPropagation()}
            >
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-3 left-3 w-8 h-8 rounded-full bg-rose-100 text-rose-600 font-bold hover:bg-rose-200 transition"
                    >
                        ×
                    </button>
                )}
                {title && (
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-parchment-300">
                        {icon && <span className="text-2xl">{icon}</span>}
                        <h3 className="text-xl font-extrabold text-ink-800">{title}</h3>
                    </div>
                )}
                {children}
            </div>
        </div>
    );
}

/**
 * ConfirmModal — جایگزین window.confirm.
 * استفاده: <ConfirmModal open={...} onConfirm={...} onCancel={...} message="..." />
 */
export function ConfirmModal({ open, onConfirm, onCancel, title = 'تایید عملیات', message, danger = false, confirmLabel = 'تایید' }) {
    return (
        <Modal open={open} onClose={onCancel} title={title} icon={danger ? '⚠️' : '❓'} size="sm">
            <p className="text-sm text-ink-700 mb-6 leading-relaxed">{message}</p>
            <div className="flex gap-3">
                <button onClick={onCancel} className="btn-ghost flex-1">انصراف</button>
                <button onClick={onConfirm} className={`flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`}>
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}

/**
 * AlertModal — جایگزین window.alert.
 */
export function AlertModal({ open, onClose, title = 'اطلاع', message, tone = 'info' }) {
    const icons = { info: 'ℹ️', success: '✅', error: '⚠️' };
    return (
        <Modal open={open} onClose={onClose} title={title} icon={icons[tone]} size="sm">
            <p className="text-sm text-ink-700 mb-6 leading-relaxed whitespace-pre-wrap">{message}</p>
            <button onClick={onClose} className="btn-primary w-full">باشه</button>
        </Modal>
    );
}