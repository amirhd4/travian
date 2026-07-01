import { useEffect, useState, useCallback } from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import ResourceBar from '../components/ResourceBar';
import { useGameWebSocket } from '../hooks/useGameWebSocket';

// کامپوننت گرافیکی رسم هر جایگاه ساختمان
const BuildingSlot = ({ x, y, level, name, onClick }) => {
    // رسم دایره جایگاه
    const draw = useCallback((g) => {
        g.clear();
        // اگر لول صفر بود (خالی) خاکستری، در غیر اینصورت سبز تراوین
        g.beginFill(level > 0 ? 0x5c8a00 : 0xd1d5db);
        g.lineStyle(3, 0x374151); // حاشیه
        g.drawCircle(0, 0, 45); // شعاع دایره
        g.endFill();
    }, [level]);

    return (
        <Container x={x} y={y} interactive={true} pointerdown={onClick} cursor="pointer">
            <Graphics draw={draw} />
            <Text
                text={level > 0 ? `${name}\nسطح ${level}` : "جایگاه\nخالی"}
                anchor={0.5}
                style={new PIXI.TextStyle({
                    fontSize: 14,
                    fill: level > 0 ? '#ffffff' : '#4b5563',
                    align: 'center',
                    fontWeight: 'bold',
                    fontFamily: 'Tahoma'
                })}
            />
        </Container>
    );
};

export default function VillageMap() {
    const [buildings, setBuildings] = useState([]);
    const setResources = useGameStore((state) => state.updateResources);

    // فعال‌سازی وب‌سوکت برای این صفحه
    useGameWebSocket();

    // دریافت اطلاعات اولیه دهکده از بک‌اند
    const fetchVillageData = async () => {
        try {
            /*
             * در یک سناریوی واقعی، دیتا را با یک رکوئست GET می‌گیریم:
             * const res = await api.get('game/village/me/');
             * اما فعلاً برای تست رابط کاربری، دیتا را Mock می‌کنیم:
             */
            setBuildings([
                { position: 1, level: 5, name: 'چوب‌بری', x: 200, y: 150 },
                { position: 2, level: 0, name: '', x: 400, y: 150 },
                { position: 3, level: 3, name: 'انبار', x: 600, y: 150 },
                { position: 4, level: 0, name: '', x: 300, y: 300 },
                { position: 5, level: 1, name: 'ساختمان اصلی', x: 500, y: 300 },
                { position: 6, level: 2, name: 'پادگان', x: 400, y: 450 },
            ]);

            // تنظیم منابع اولیه در استیت
            setResources({ wood: 1200, clay: 800, iron: 900, crop: 1500 });
        } catch (error) {
            console.error("خطا در دریافت اطلاعات دهکده", error);
        }
    };

    useEffect(() => {
        fetchVillageData();
    }, []);

    // هندل کردن کلیک روی جایگاه ساختمان
    const handleSlotClick = async (position) => {
        const confirmed = window.confirm(`آیا می‌خواهید ساختمان جایگاه ${position} را ارتقا دهید؟`);

        if (confirmed) {
            try {
                // ارسال درخواست ارتقا به بک‌اند (فایل views.py که قبلا نوشتیم)
                // توجه: village_id را باید از استیت کاربر برداریم، اینجا برای تست 1 گذاشتیم
                const response = await api.post('game/upgrade-building/', {
                    village_id: 1,
                    position: position
                });

                alert(response.data.message || "ارتقا با موفقیت آغاز شد!");
                // بعد از ارتقا می‌توانیم دوباره fetchVillageData را صدا بزنیم یا موجودی را موقتاً کم کنیم

            } catch (error) {
                const errorMsg = error.response?.data?.error || "خطای ناشناخته در ارتباط با سرور";
                alert(`خطا: ${errorMsg}`);
            }
        }
    };

    return (
        <div className="relative w-full h-screen bg-[#c2d79c] flex flex-col justify-center items-center overflow-hidden">
            <ResourceBar />

            {/* کادر دور نقشه دهکده */}
            <div className="relative border-8 border-[#8B5A2B] rounded-xl shadow-2xl overflow-hidden mt-12 bg-[#e0e6b8]">
                {/* موتور رندر PixiJS */}
                <Stage width={800} height={600} options={{ backgroundAlpha: 0 }}>
                    {buildings.map((b) => (
                        <BuildingSlot
                            key={b.position}
                            x={b.x}
                            y={b.y}
                            level={b.level}
                            name={b.name}
                            onClick={() => handleSlotClick(b.position)}
                        />
                    ))}
                </Stage>
            </div>
        </div>
    );
}