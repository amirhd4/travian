export default function Footer() {
    return (
        <div id="footer" style={{ clear: 'both' }}>
            <div id="mfoot">
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>Edited by: </span>
                <span style={{ color: 'red', fontWeight: 'bold', fontSize: '12px' }}>travian.ir</span>
                <div className="clear"></div>
            </div>
            <p style={{ margin: '8px 0', fontSize: '11px', color: 'white' }}>
                Support: <a href="mailto:travian@gmail.com" style={{ color: 'red', textDecoration: 'underline' }}>travian@gmail.com</a>
            </p>
        </div>
    );
}