import { useNavigate } from 'react-router-dom';

export default function Footer() {
    const navigate = useNavigate();
    return (
        <div id="footer" style={{ clear: 'both' }}>
            <div id="mfoot">
                <span style={{ color: 'white', fontWeight: 'bold', fontSize: '12px' }}>Edited by: </span>
                <span style={{ color: 'red', fontWeight: 'bold', fontSize: '12px' }}>travian.ir</span>
                <div className="clear"></div>
            </div>
            <p style={{ margin: '8px 0', fontSize: '11px', color: 'white', fontWeight: "bold"}}>
                پشتیبانی:{' '}
                <a href="#" style={{ color: 'red', textDecoration: 'underline' }}
                    onClick={(e) => {
                        e.preventDefault();
                        navigate('/messages?tab=compose&to=majditravian&subject=درخواست پشتیبانی');
                    }}>
                    تماس با ادمین
                </a>
            </p>
        </div>
    );
}
