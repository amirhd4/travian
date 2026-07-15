export default function Footer() {
    return (
        <footer className="w-full shrink-0 h-36 bg-[#A2BA7C] text-ink-800">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
                <div className="flex items-center gap-3">
                    <span className="text-ink-700 font-bold">پشتیبانی: support@travian.ir</span>
                </div>

                <div className="flex items-center gap-2 text-ink-600">
                    <span>سرور تراوین کور نسخه ۱.۰.۰</span>
                    <span>•</span>
                    <span>© {new Date().getFullYear()} تمامی حقوق محفوظ است</span>
                </div>
            </div>
        </footer>
    );
}
