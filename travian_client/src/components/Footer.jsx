export default function Footer() {
    return (
        <div style={{
            fontSize: '11px',
            lineHeight: '11px',
            textAlign: 'center',
            color: '#FFF',
            background: "url('/assets/layout/footer.png') no-repeat",
            padding: '15px 0 30px',
        }}>
            <div style={{ width: '990px', margin: '0 auto', position: 'relative' }}>
                <a href="/" style={{ color: '#FFF', fontWeight: 'normal', borderRight: '1px solid #FFF', padding: '0 10px' }}>خانه</a>
                <a href="#" style={{ color: '#FFF', fontWeight: 'normal', borderRight: '1px solid #FFF', padding: '0 10px' }}>انجمن</a>
                <a href="/login" style={{ color: '#FFF', fontWeight: 'normal', borderRight: '1px solid #FFF', padding: '0 10px' }}>ورود</a>
                <a href="/register" style={{ color: '#FFF', fontWeight: 'normal', borderRight: '1px solid #FFF', padding: '0 10px' }}>ثبت‌نام</a>
                <a href="#" style={{ color: '#FFF', fontWeight: 'normal', padding: '0 10px' }}>پشتیبانی</a>
                <div style={{ clear: 'both' }} />
            </div>
            <p style={{ marginTop: '10px' }}>&copy; {new Date().getFullYear()} تمامی حقوق محفوظ است</p>
        </div>
    );
}
