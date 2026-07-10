import React from 'react';
import useGameStore from '../store/useGameStore';

export default function Footer() {
    const user = useGameStore((state) => state.user); // فرض بر اینکه اطلاعات کاربر در استیت ذخیره است

    return (
        <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-t from-wood-dark to-wood border-t-4 border-wood-light text-parchment shadow-2xl z-[100] px-4 py-36 text-xs font-sans">
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1">
                {/* بخش اطلاعات بازیکن */}
                <div className="flex items-center gap-4 bg-black/20 px-3 py-0.5 rounded-full border border-wood-light/40">
                    <span className="flex items-center gap-1">👤 بازیکن: <strong className="text-travian-gold">{user?.username || 'مهمان'}</strong></span>
                    <span className="text-wood-light">|</span>
                    <span className="flex items-center gap-1">📧 ایمیل: <strong className="text-gray-300">{user?.email || '—'}</strong></span>
                </div>

                {/* بخش کپی رایت و نسخه */}
                <div className="flex items-center gap-3 text-[11px] text-parchment-dark">
                    <span>سرور تراوین کور نسخه ۱.۰.۰</span>
                    <span className="text-wood-light">•</span>
                    <span>© {new Date().getFullYear()} تمامی حقوق محفوظ است.</span>
                </div>
            </div>
        </footer>
    );
}