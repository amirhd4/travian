export function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    const parts = [h, m, s].map((n) => String(n).padStart(2, '0'));
    return d > 0 ? `${d}d ${parts.join(':')}` : parts.join(':');
}
