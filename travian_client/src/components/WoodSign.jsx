export default function WoodSign({ title, icon, children, className = '' }) {
    return (
        <div className={`wood-sign ${className}`}>
            {title && (
                <h3 className="text-base font-extrabold text-ink-800 mb-3 pb-2 border-b border-parchment-300 flex items-center gap-2">
                    {icon && <span>{icon}</span>}
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
}