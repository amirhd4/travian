import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResourceBar from '../components/ResourceBar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import LoadingState from '../components/LoadingState';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';

const RADIUS = 2;

const CELL_STYLES = {
    mine:      'bg-gradient-to-b from-blue-200 to-blue-300 border-blue-500 text-blue-900 font-bold',
    ww:        'bg-gradient-to-b from-purple-300 to-purple-400 border-purple-600 text-purple-900 font-bold cursor-pointer animate-pulse',
    planGuard: 'bg-gradient-to-b from-orange-300 to-orange-400 border-orange-600 text-orange-900 font-bold cursor-pointer',
    natar:     'bg-gradient-to-b from-rose-300 to-rose-400 border-rose-600 text-rose-900 font-bold cursor-pointer',
    village:   'bg-gradient-to-b from-brand-200 to-brand-300 border-brand-500 text-brand-900 hover:brightness-105 cursor-pointer',
    empty:     'bg-parchment-100 border-parchment-300 text-ink-400',
};

export default function WorldMap() {
    const navigate = useNavigate();
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [mapVillages, setMapVillages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const activeVillage = villages.find((v) => v.id === activeVillageId);
        if (activeVillage) setCenter({ x: activeVillage.x_coord, y: activeVillage.y_coord });
    }, [villages, activeVillageId]);

    useEffect(() => {
        const fetchMap = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('game/world-map/', { params: { x: center.x, y: center.y, radius: RADIUS } });
                setMapVillages(data);
            } catch (error) {
                console.error("خطا در دریافت نقشه جهان", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMap();
    }, [center]);

    const grid = [];
    for (let y = center.y + RADIUS; y >= center.y - RADIUS; y--) {
        for (let x = center.x - RADIUS; x <= center.x + RADIUS; x++) {
            const found = mapVillages.find((v) => v.x_coord === x && v.y_coord === y);
            grid.push({
                x, y, hasVillage: !!found,
                name: found ? found.name : "بیابان",
                owner: found ? found.owner : null,
                isNatar: found ? found.is_natar : false,
                isMine: found ? found.id === activeVillageId : false,
                id: found ? found.id : null,
                isWwSite: found ? found.is_natar_ww_site : false,
                isPlanGuard: found ? found.is_natar_plan_guard : false,
            });
        }
    }

    const cellStyleFor = (cell) => {
        if (cell.isMine) return CELL_STYLES.mine;
        if (cell.isWwSite) return CELL_STYLES.ww;
        if (cell.isPlanGuard) return CELL_STYLES.planGuard;
        if (cell.isNatar) return CELL_STYLES.natar;
        if (cell.hasVillage) return CELL_STYLES.village;
        return CELL_STYLES.empty;
    };

    const handleCellClick = (cell) => {
        if (cell.hasVillage && !cell.isMine) {
            navigate('/send-troops', { state: { targetVillageId: cell.id, targetName: cell.name } });
        }
    };

    return (
        <div
            className="w-full min-h-screen pt-24 pb-16 flex flex-col items-center"
            style={{
                // پیشنهاد عکس: /assets/maps/world-map-bg.jpg (بافت زمین/جنگل از بالا، سبک نقاشی فانتزی)
                backgroundImage: "linear-gradient(180deg, rgba(15,35,20,.55), rgba(15,35,20,.75)), url('/assets/maps/world-map-bg.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundColor: '#12321c',
            }}
        >
            <ResourceBar />
            <Navbar />

            <div className="panel !bg-parchment-50/95 backdrop-blur p-6 max-w-2xl w-full mx-4 mt-2">
                <h2 className="text-lg font-extrabold text-ink-800 mb-4 text-center">
                    🗺️ نقشه منطقه‌ای سرور <span className="text-ink-400 font-normal text-sm">(اطراف {center.x}|{center.y})</span>
                </h2>

                {loading ? (
                    <LoadingState label="در حال بارگذاری نقشه..." />
                ) : (
                    <div className="grid grid-cols-5 gap-2 bg-ink-900/5 p-3 rounded-xl border border-parchment-300">
                        {grid.map((cell, index) => (
                            <div
                                key={index}
                                onClick={() => handleCellClick(cell)}
                                className={`h-24 flex flex-col items-center justify-center border-2 rounded-lg text-xs p-1 transition select-none ${cellStyleFor(cell)}`}
                            >
                                <span className="font-bold opacity-70 text-[10px]">[{cell.x}, {cell.y}]</span>
                                <span className="text-center mt-1 font-semibold truncate w-full">
                                    {cell.isMine ? '👑 ' : ''}{cell.name}
                                </span>
                                {cell.owner && !cell.isNatar && !cell.isMine && (
                                    <span className="text-[10px] opacity-70 truncate w-full">{cell.owner}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-3 justify-center mt-4 text-[10px] font-bold text-ink-600">
                    <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-blue-300 inline-block" />دهکده من</span>
                    <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-brand-300 inline-block" />بازیکن دیگر</span>
                    <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-rose-300 inline-block" />ناتار</span>
                    <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-purple-300 inline-block" />محل شگفتی جهان</span>
                    <span className="flex items-center gap-1"><i className="w-3 h-3 rounded-full bg-orange-300 inline-block" />نگهبان نقشه</span>
                </div>
                <p className="text-xs text-ink-500 mt-3 text-center">برای اعزام نیرو به هر دهکده، روی آن کلیک کنید.</p>
            </div>

            <Footer />
        </div>
    );
}