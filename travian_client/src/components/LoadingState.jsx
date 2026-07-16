export default function LoadingState({ label = 'در حال بارگذاری...' }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px' }}>
            <div style={{ width: '32px', height: '32px', border: '3px solid #E5E5E5', borderTopColor: '#498843', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#252525' }}>{label}</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
