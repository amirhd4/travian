import useGameStore from '../store/useGameStore';
import WoodSign from './WoodSign';

export default function SideInfoBoards() {
    const user = useGameStore((state) => state.user);
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const activeVillage = villages.find((v) => v.id === activeVillageId);

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
        </>
    );
}