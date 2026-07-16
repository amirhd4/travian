export default function EmptyState({ icon = '📭', title, description }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 16px' }}>
            <span style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.6 }}>{icon}</span>
            <p style={{ fontWeight: 'bold', color: '#252525' }}>{title}</p>
            {description && <p style={{ fontSize: '11px', color: '#777', marginTop: '4px' }}>{description}</p>}
        </div>
    );
}
