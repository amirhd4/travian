import { useEffect } from 'react';

export function Modal({ open, onClose, title, icon, children, size = 'md' }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={onClose}
        >
            <div
                style={{ background: '#FFF', border: '2px solid #C9C9C9', maxWidth: size === 'sm' ? '400px' : size === 'md' ? '500px' : '600px', width: '100%', position: 'relative' }}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div style={{
                        background: '#498843',
                        color: '#FFF',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        padding: '6px 12px',
                        borderBottom: '1px solid #3a6e35',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <span className="flex items-center gap-2">
                            {icon && <span>{icon}</span>}
                            {title}
                        </span>
                        {onClose && (
                            <button
                                onClick={onClose}
                                style={{ background: '#DE0000', border: '1px solid #aa0000', color: '#FFF', width: '18px', height: '18px', cursor: 'pointer', fontSize: '12px', lineHeight: '18px', textAlign: 'center', padding: 0 }}
                            >
                                ×
                            </button>
                        )}
                    </div>
                )}
                <div style={{ padding: '12px' }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export function ConfirmModal({ open, onConfirm, onCancel, title = 'تایید عملیات', message, danger = false, confirmLabel = 'تایید' }) {
    const handleConfirm = async () => {
        try {
            await onConfirm?.();
        } catch (err) {
            console.error('ConfirmModal onConfirm error:', err);
        }
    };

    return (
        <Modal open={open} onClose={onCancel} title={title} icon={danger ? '⚠️' : '❓'} size="sm">
            <p style={{ fontSize: '13px', color: '#252525', marginBottom: '24px', lineHeight: '20px' }}>{message}</p>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={onCancel} className="btn-ghost" style={{ flex: 1 }}>انصراف</button>
                <button onClick={handleConfirm} className={danger ? 'btn-danger' : 'btn-primary'} style={{ flex: 1 }}>
                    {confirmLabel}
                </button>
            </div>
        </Modal>
    );
}

export function AlertModal({ open, onClose, title = 'اطلاع', message, tone = 'info' }) {
    const icons = { info: 'ℹ️', success: '✅', error: '⚠️' };
    return (
        <Modal open={open} onClose={onClose} title={title} icon={icons[tone]} size="sm">
            <p style={{ fontSize: '13px', color: '#252525', marginBottom: '24px', lineHeight: '20px', whiteSpace: 'pre-wrap' }}>{message}</p>
            <button onClick={onClose} className="btn-primary" style={{ width: '100%' }}>باشه</button>
        </Modal>
    );
}
