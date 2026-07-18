export default function Footer() {
    return (
        <div id="footer">
            <div id="mfoot">
                <a href="/">خانه</a>
                <a href="#">انجمن</a>
                <a href="/login">ورود</a>
                <a href="/register">ثبت‌نام</a>
                <a href="#">پشتیبانی</a>
                <div className="clear"></div>
            </div>
            <p>&copy; {new Date().getFullYear()} تمامی حقوق محفوظ است</p>
        </div>
    );
}
