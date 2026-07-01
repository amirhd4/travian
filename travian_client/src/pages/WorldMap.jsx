import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ResourceBar from '../components/ResourceBar';
import Navbar from '../components/Navbar';

export default function WorldMap() {
    const [mapGrid, setMapGrid] = useState([]);
    const navigate = useNavigate();

    // شبیه‌سازی دریافت اطلاعات نقشه بزرگ بازی از دیتابیس
    useEffect(() => {
        const grid = [];
        // ساخت یک شبکه کوچک ۵ در ۵ برای نمونه نمایشی دور مختصات (0,0)
        for (let y = 2; y >= -2; y--) {
            for (let x = -2; x <= 2; x++) {
                grid.push({
                    x,
                    y,
                    hasVillage: x === 0 && y === 0 ? true : Math.random() > 0.8,
                    name: x === 0 && y === 0 ? "پایتخت ناتارها" : `دهکده (${x},${y})`,
                    id: Math.floor(Math.random() * 1000) + 2
                });
            }
        }
        setMapGrid(grid);
    }, []);

    const handleCellClick = (cell) => {
        if (cell.hasVillage) {
            navigate('/send-troops', { state: { targetVillageId: cell.id, targetName: cell.name } });
        }
    };

    return (
        <div className="w-full h-screen bg-emerald-900 pt-28 flex flex-col items-center">
            <ResourceBar />
            <Navbar />

            <div className="bg-amber-100 p-6 rounded-xl shadow-2xl border-4 border-amber-800 max-w-2xl w-full">
                <h2 className="text-xl font-bold text-amber-900 mb-4 text-center">نقشه منطقه‌ای سرور</h2>

                <div className="grid grid-cols-5 gap-2 bg-amber-200 p-3 rounded-lg border border-amber-400">
                    {mapGrid.map((cell, index) => (
                        <div
                            key={index}
                            onClick={() => handleCellClick(cell)}
                            className={`h-24 flex flex-col items-center justify-center border text-xs p-1 rounded font-sans transition cursor-pointer select-none
                                ${cell.x === 0 && cell.y === 0 ? 'bg-red-300 border-red-600 text-red-900 font-bold' : 
                                  cell.hasVillage ? 'bg-green-200 border-green-500 text-green-900 hover:bg-green-300' : 'bg-yellow-50 border-yellow-300 text-gray-400 hover:bg-yellow-100'}`}
                        >
                            <span className="font-bold text-gray-600">[{cell.x}, {cell.y}]</span>
                            <span className="text-center mt-1 font-semibold truncate w-full">
                                {cell.hasVillage ? cell.name : "بیابان"}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-amber-800 mt-3 text-center">برای اعزام نیرو به هر دهکده، روی آن کلیک کنید.</p>
            </div>
        </div>
    );
}