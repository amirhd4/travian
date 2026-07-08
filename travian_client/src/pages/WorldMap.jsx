import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResourceBar from '../components/ResourceBar';
import Navbar from '../components/Navbar';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';

const RADIUS = 2; // شبکه ۵ در ۵ (مشابه قبل) اطراف مرکز

export default function WorldMap() {
    const navigate = useNavigate();
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [mapVillages, setMapVillages] = useState([]);
    const [loading, setLoading] = useState(true);

    // مرکز نقشه را روی مختصات دهکده فعال بازیکن قرار می‌دهیم (قبلا همیشه
    // ثابت و بی‌ربط به بازیکن، دور (0,0) بود)
    useEffect(() => {
        const activeVillage = villages.find((v) => v.id === activeVillageId);
        if (activeVillage) {
            setCenter({ x: activeVillage.x_coord, y: activeVillage.y_coord });
        }
    }, [villages, activeVillageId]);

    useEffect(() => {
        const fetchMap = async () => {
            setLoading(true);
            try {
                const { data } = await api.get('game/world-map/', {
                    params: { x: center.x, y: center.y, radius: RADIUS }
                });
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
                x, y,
                hasVillage: !!found,
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

    const handleCellClick = (cell) => {
        if (cell.hasVillage && !cell.isMine) {
            navigate('/send-troops', { state: { targetVillageId: cell.id, targetName: cell.name } });
        }
    };

    return (
        <div className="w-full h-screen bg-emerald-900 pt-28 flex flex-col items-center">
            <ResourceBar />
            <Navbar />

            <div className="bg-amber-100 p-6 rounded-xl shadow-2xl border-4 border-amber-800 max-w-2xl w-full">
                <h2 className="text-xl font-bold text-amber-900 mb-4 text-center">
                    نقشه منطقه‌ای سرور (اطراف {center.x}|{center.y})
                </h2>

                {loading ? (
                    <p className="text-center font-bold text-amber-800 py-10">در حال بارگذاری نقشه...</p>
                ) : (
                    <div className="grid grid-cols-5 gap-2 bg-amber-200 p-3 rounded-lg border border-amber-400">
                        {grid.map((cell, index) => (
                            <div
                                key={index}
                                onClick={() => handleCellClick(cell)}
                                className={`h-24 flex flex-col items-center justify-center border text-xs p-1 rounded font-sans transition select-none
                                    ${cell.isMine ? 'bg-blue-200 border-blue-600 text-blue-900 font-bold' :
                                      cell.isWwSite ? 'bg-purple-300 border-purple-700 text-purple-900 font-bold cursor-pointer animate-pulse' :
                                      cell.isPlanGuard ? 'bg-orange-300 border-orange-700 text-orange-900 font-bold cursor-pointer' :
                                      cell.isNatar ? 'bg-red-300 border-red-600 text-red-900 font-bold cursor-pointer' :
                                      cell.hasVillage ? 'bg-green-200 border-green-500 text-green-900 hover:bg-green-300 cursor-pointer' :
                                      'bg-yellow-50 border-yellow-300 text-gray-400'}`}
                            >
                                <span className="font-bold text-gray-600">[{cell.x}, {cell.y}]</span>
                                <span className="text-center mt-1 font-semibold truncate w-full">
                                    {cell.isMine ? '👑 ' : ''}{cell.name}
                                </span>
                                {cell.owner && !cell.isNatar && !cell.isMine && (
                                    <span className="text-[10px] text-gray-500 truncate w-full">{cell.owner}</span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
                <p className="text-xs text-amber-800 mt-3 text-center">برای اعزام نیرو به هر دهکده، روی آن کلیک کنید.</p>
            </div>
        </div>
    );
}