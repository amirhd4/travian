export default function Footer() {
    return (
        <div id="footer" style={{ clear: 'both' }}>
            <div id="mfoot">
                <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '12px' }}>Edited by: travian.ir</span>
                <div className="clear"></div>
            </div>
            <p style={{ margin: '8px 0', fontSize: '11px', color: '#FFD700' }}>
                Support: <a href="mailto:travian@gmail.com" style={{ color: '#FFD700', textDecoration: 'underline' }}>travian@gmail.com</a>
            </p>
        </div>
    );
}