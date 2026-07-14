import { useState, useEffect } from 'react';
import useGameStore from '../store/useGameStore';
import WoodSign from './WoodSign';
import api from '../api/axiosConfig';
import { formatDuration } from '../utils/formatter';

export default function SideInfoBoards() {
    const user = useGameStore((state) => state.user);
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const activeVillage = villages.find((v) => v.id === activeVillageId);

    const [serverStatus, setServerStatus] = useState(null);

    useEffect(() => {
        api.get('game/server-status/')
            .then(({ data }) => setServerStatus(data))
            .catch(() => {});
        const interval = setInterval(() => {
            api.get('game/server-status/')
                .then(({ data }) => setServerStatus(data))
                .catch(() => {});
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    const [remaining, setRemaining] = useState(null);
    useEffect(() => {
        if (!serverStatus?.artifacts_release_at || serverStatus.artifacts_unlocked) {
            setRemaining(null);
            return;
        }
        const tick = () => {
            const diff = Math.max(0,
                Math.floor((new Date(serverStatus.artifacts_release_at).getTime() - Date.now()) / 1000)
            );
            setRemaining(diff);
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [serverStatus]);

    if (!user) return null;

    return (
        <>
            <div className="hidden xl:block fixed top-32 left-3 w-48 z-[101]">
                <WoodSign title={`👤 ${user.username || ''}`}>
                    <p className="text-xs font-bold text-wood mb-1 text-center">🏘️ دهکده‌ها:</p>
                    <ul className="text-[11px] text-wood-dark space-y-1 max-h-32 overflow-y-auto">
                        {villages.map((v) => (
                            <li key={v.id} className={v.id === activeVillageId ? 'font-bold text-amber-700' : ''}>
                                {v.is_capital ? '👑' : '🏘️'} {v.name}
                            </li>
                        ))}
                    </ul>
                </WoodSign>
            </div>

            {activeVillage && (
                <div className="hidden xl:block fixed top-32 right-3 w-48 z-[101]">
                    <WoodSign title={activeVillage.name}>
                        <p className="text-[11px] text-center font-bold text-green-700">
                            وفاداری: {activeVillage.loyalty ?? 100}٪
                        </p>
                        <p className="text-[11px] text-center text-wood-dark mt-1" dir="ltr">
                            ({activeVillage.x_coord}|{activeVillage.y_coord})
                        </p>
                    </WoodSign>
                </div>
            )}

            {remaining !== null && remaining > 0 && (
                <div className="hidden xl:block fixed top-32 right-3 w-48 z-[100]" style={{ top: '16rem' }}>
                    <WoodSign title="🏺 کتیبه‌ها">
                        <p className="text-[11px] text-center font-bold text-orange-700">
                            آزادسازی در:
                        </p>
                        <p className="text-sm text-center font-mono text-wood-dark font-bold" dir="ltr">
                            {formatDuration(remaining)}
                        </p>
                    </WoodSign>
                </div>
            )}
        </>
    );
}