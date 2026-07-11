export default function LoadingState({ label = 'در حال بارگذاری...' }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            <p className="font-bold text-ink-600 text-sm">{label}</p>
        </div>
    );
}