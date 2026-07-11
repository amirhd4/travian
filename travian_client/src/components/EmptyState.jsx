export default function EmptyState({ icon = '📭', title, description }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-12 px-4">
            <span className="text-4xl mb-3 opacity-60">{icon}</span>
            <p className="font-bold text-ink-700">{title}</p>
            {description && <p className="text-xs text-ink-500 mt-1">{description}</p>}
        </div>
    );
}