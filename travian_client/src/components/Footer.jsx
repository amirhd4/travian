export default function Footer() {
    return (
        <div id="footer" style={{ clear: 'both' }}>
            <div id="mfoot">
                <a href="/village">خانه</a>
                <a href="#">انجمن</a>
                <a href="/login">ورود</a>
                <a href="/register">ثبت‌نام</a>
                <a href="#">پشتیبانی</a>
                <div className="clear"></div>
            </div>
            <p style={{ margin: '8px 0', fontSize: '11px' }}>&copy; {new Date().getFullYear()} تمامی حقوق محفوظ است</p>
        </div>
    );
}
