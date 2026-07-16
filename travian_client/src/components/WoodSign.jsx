export default function WoodSign({ title, icon, iconElement, children, className = '' }) {
    return (
        <div className={`wood-sign ${className}`}>
            {title && (
                <h3>
                    {iconElement || (icon && <span>{icon}</span>)}
                    {title}
                </h3>
            )}
            <div>
                {children}
            </div>
        </div>
    );
}
