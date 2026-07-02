import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';

export default function VillageMap() {
    const pixiContainerRef = useRef(null);
    const pixiAppRef = useRef(null);

    useEffect(() => {
        // جلوگیری از راه‌اندازی دوگانه در حالت React Strict Mode
        if (pixiAppRef.current) return;

        let isMounted = true;
        let app = null;

        async function setupPixi() {
            // ۱. ساخت نمونه خام اپلیکیشن (طبق استاندارد نسخه 8)
            app = new PIXI.Application();

            // ۲. مقداردهی اولیه به صورت ناهمگام (Async)
            await app.init({
                width: 800,
                height: 600,
                backgroundColor: 0x000000, // پس‌زمینه مشکی محیط داخلی دهکده
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                antialias: true,
            });

            // اگر کاربر قبل از لود شدن کامل از صفحه خارج شده بود، متوقف کن
            if (!isMounted) {
                app.destroy(true, { children: true });
                return;
            }

            pixiAppRef.current = app;

            // ۳. متصل کردن بوم نقاشی به DOM (در نسخه 8 از app.canvas استفاده می‌شود)
            if (pixiContainerRef.current) {
                pixiContainerRef.current.appendChild(app.canvas);
            }

            // اطلاعات ساختمان‌های دهکده
            const buildings = [
                { id: 1, name: 'چوب‌بری\nسطح 5', x: 250, y: 200, color: 0x4a7c1b },
                { id: 2, name: 'جایگاه\nخالی', x: 400, y: 200, color: 0xc8cce8 },
                { id: 3, name: 'انبار\nسطح 3', x: 550, y: 200, color: 0x4a7c1b },
                { id: 4, name: 'جایگاه\nخالی', x: 325, y: 350, color: 0xc8cce8 },
                { id: 5, name: 'ساختمان اصلی\nسطح 1', x: 475, y: 350, color: 0x4a7c1b },
                { id: 6, name: 'پادگان\nسطح 2', x: 400, y: 500, color: 0x4a7c1b },
            ];

            // ۴. رسم ساختمان‌ها با متد جدید مدرن PixiJS v8
            buildings.forEach((b) => {
                const buildingContainer = new PIXI.Container();

                buildingContainer.x = b.x;
                buildingContainer.y = b.y;
                buildingContainer.eventMode = 'static';
                buildingContainer.cursor = 'pointer';

                // افکت‌های هاور و کلیک روی کل کانتینر
                buildingContainer.on('pointerover', () => {
                    buildingContainer.alpha = 0.8;
                });
                buildingContainer.on('pointerout', () => {
                    buildingContainer.alpha = 1.0;
                });
                buildingContainer.on('pointerdown', () => {
                    alert(`شما روی ساختمان "${b.name.replace('\n', ' ')}" کلیک کردید.`);
                });

                // ۲. رسم دایره (بدون x و y چون کانتینر جابجا شده است)
                const circle = new PIXI.Graphics();
                circle.circle(0, 0, 45);
                circle.fill({ color: b.color });

                // ۳. ایجاد متن
                const text = new PIXI.Text({
                    text: b.name,
                    style: {
                        fontFamily: 'Tahoma, Arial',
                        fontSize: 13,
                        fill: b.color === 0xc8cce8 ? 0x222222 : 0xffffff,
                        align: 'center',
                        fontWeight: 'bold',
                    }
                });
                text.anchor.set(0.5);

                // ۴. اضافه کردن دایره و متن به کانتینر (این کار ارور را حل می‌کند)
                buildingContainer.addChild(circle);
                buildingContainer.addChild(text);

                // ۵. اضافه کردن کانتینر به استیج اصلی
                app.stage.addChild(buildingContainer);
            });
        }

        setupPixi();

        // پاکسازی حافظه هنگام خروج از صفحه برای جلوگیری از کرش (Memory Leak)
        return () => {
            isMounted = false;
            if (pixiAppRef.current) {
                pixiAppRef.current.destroy(true, { children: true });
                pixiAppRef.current = null;
            }
        };
    }, []);

    return (
        // لایه‌بندی اصلاح شده برای فیکس شدن مشکل نوار ناوبری
        <div className="w-full min-h-screen bg-[#c2d69b] flex flex-col items-center pt-32 pb-10">
            <ResourceBar />
            <Navbar />

            {/* باکس نگه‌دارنده نقشه بازی با فریم قهوه‌ای نوستالژیک تراوین */}
            <div
                className="shadow-2xl border-[12px] border-[#593d2b] rounded-lg overflow-hidden relative bg-black"
                ref={pixiContainerRef}
                style={{ width: '800px', height: '600px' }}
            >
            </div>
        </div>
    );
}