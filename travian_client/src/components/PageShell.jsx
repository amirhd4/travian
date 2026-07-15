/**
 * قالب استاندارد صفحات بازی: محتوا وسط با عرض ثابت.
 * ResourceBar / Navbar / Footer توسط GameLayout رندر می‌شوند.
 */
export default function PageShell({ children, maxWidth = 'max-w-4xl', bg = 'game-bg' }) {
    return (
        <div className={`${bg} flex flex-col items-center`}>
            <div className={`w-full ${maxWidth} px-4 flex flex-col gap-6 mt-4`}>
                {children}
            </div>
        </div>
    );
}
