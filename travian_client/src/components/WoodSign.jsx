export default function WoodSign({ title, icon, iconElement, children, className = '' }) {
    return (
        <div className={`relative bg-amber-800 border-[4px] border-amber-950 rounded-xl shadow-[0_8px_16px_rgba(0,0,0,0.4)] overflow-hidden ${className}`}>
            {/* بافت چوب (تزئینی) */}
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-600 via-amber-900 to-black"></div>

            {title && (
                <div className="bg-amber-900 border-b-4 border-amber-950 px-4 py-3 flex items-center justify-center gap-3 shadow-inner relative z-10">
                    {iconElement || (icon && <span className="text-2xl drop-shadow-md">{icon}</span>)}
                    <h3 className="text-lg md:text-xl font-black text-amber-50 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] tracking-wide">
                        {title}
                    </h3>
                </div>
            )}
            
            {/* پس‌زمینه کاغذی/پوستی برای محتوا */}
            <div className="p-4 md:p-6 relative z-10 bg-[#fdfaf3] shadow-inner m-1 rounded-b-lg border border-amber-200">
                {children}
            </div>
        </div>
    );
}