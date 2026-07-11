import useGameStore from '../store/useGameStore';

export default function Footer() {
    const user = useGameStore((state) => state.user);

    return (
        <footer className="w-full shrink-0 h-36 bg-brand-300 backdrop-blur border-t border-ink-800 text-parchment-100">
            <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5">
                        <span className="w-6 h-6 rounded-full bg-gold-500/20 flex items-center justify-center">👤</span>
                        <strong className="text-gold-400">{user?.username || 'مهمان'}</strong>
                    </span>
                    <span className="text-ink-600">|</span>
                    <span className="text-parchment-300">{user?.email || '—'}</span>
                </div>

                <div className="flex items-center gap-2 text-parchment-300/80">
                    <span>سرور تراوین کور نسخه ۱.۰.۰</span>
                    <span>•</span>
                    <span>© {new Date().getFullYear()} تمامی حقوق محفوظ است</span>
                </div>
            </div>
        </footer>
    );
}