export default function WoodSign({ title, children, className = '' }) {
    return (
        <div className={`wood-sign ${className}`}>
            {title && (
                <h3 className="text-sm font-extrabold text-wood-dark text-center mb-2 border-b-2 border-[#c9b98a] pb-1">
                    {title}
                </h3>
            )}
            {children}
        </div>
    );
}