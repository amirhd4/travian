import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';

const CATEGORY_COLORS = {
    INFRASTRUCTURE: 0xb98c4a,
    MILITARY: 0xa1332c,
    WALL: 0x4b4b52,
    RESOURCE: 0x4a7c1b,
};

const CATEGORY_ICONS = {
    RESOURCE: { 'چوب‌بری': '🪵', 'گودال خاک رس': '🧱', 'معدن آهن': '⚒️', 'مزرعه گندم': '🌾' },
};

function resourceIcon(name) {
    return CATEGORY_ICONS.RESOURCE[name] || '🌱';
}

function formatDuration(totalSeconds) {
    if (totalSeconds <= 0) return '00:00:00';
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

function remainingSeconds(endTimeIso) {
    if (!endTimeIso) return 0;
    return Math.max(0, Math.round((new Date(endTimeIso).getTime() - Date.now()) / 1000));
}

export default function VillageMap() {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const { lastMessage } = useGameWebSocket();

    const pixiContainerRef = useRef(null);
    const pixiAppRef = useRef(null);
    const tickerFnRef = useRef(null);

    const [villageInfo, setVillageInfo] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [upgrading, setUpgrading] = useState(false);
    const [now, setNow] = useState(Date.now());

    const fetchBuildings = useCallback(async () => {
        if (!activeVillageId) return;
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/buildings/`);
            setVillageInfo(data.village);
            setBuildings(data.buildings);
        } catch (error) {
            console.error("خطا در دریافت اطلاعات ساختمان‌های دهکده", error);
        } finally {
            setLoading(false);
        }
    }, [activeVillageId]);

    useEffect(() => {
        setLoading(true);
        fetchBuildings();
    }, [fetchBuildings]);

    // به محض این‌که سرور بگه ارتقای یک ساختمان تمام شده، بلافاصله رفرش کن
    // (قبلا هیچ اتصال وب‌سوکت فعالی وجود نداشت که این پیام‌ها را دریافت کند)
    useEffect(() => {
        if (lastMessage?.type === 'building_completed') {
            fetchBuildings();
        }
    }, [lastMessage, fetchBuildings]);

    // شبکه اطمینان: هر ۳۰ ثانیه هم مستقل از وب‌سوکت دوباره همگام‌سازی کن
    useEffect(() => {
        const interval = setInterval(fetchBuildings, 30000);
        return () => clearInterval(interval);
    }, [fetchBuildings]);

    // تیک هر ثانیه فقط برای محاسبه شمارش معکوس‌های محلی، بدون درخواست جدید به سرور
    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const centerBuildings = buildings.filter((b) => b.category !== 'RESOURCE');
    const resourceFields = buildings.filter((b) => b.category === 'RESOURCE');

    // ---------- راه‌اندازی صحنه PixiJS (یک‌بار) ----------
    useEffect(() => {
        if (pixiAppRef.current) return;
        let isMounted = true;
        let app = null;

        async function setupPixi() {
            app = new PIXI.Application();
            await app.init({
                width: 620,
                height: 460,
                backgroundColor: 0x2f4a12,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true,
                antialias: true,
            });

            if (!isMounted) {
                app.destroy(true, { children: true });
                return;
            }

            pixiAppRef.current = app;
            if (pixiContainerRef.current) {
                pixiContainerRef.current.appendChild(app.canvas);
            }
        }

        setupPixi();

        return () => {
            isMounted = false;
            if (pixiAppRef.current) {
                if (tickerFnRef.current) {
                    pixiAppRef.current.ticker.remove(tickerFnRef.current);
                }
                pixiAppRef.current.destroy(true, { children: true });
                pixiAppRef.current = null;
            }
        };
    }, []);

    // ---------- بازترسیم ساختمان‌های مرکزی هر بار که داده تغییر می‌کند ----------
    useEffect(() => {
        const app = pixiAppRef.current;
        if (!app || centerBuildings.length === 0) return;

        app.stage.removeChildren();
        if (tickerFnRef.current) {
            app.ticker.remove(tickerFnRef.current);
            tickerFnRef.current = null;
        }

        const centerX = app.screen.width / 2;
        const centerY = app.screen.height / 2;
        const radius = 160;

        // هاب مرکزی تزئینی دهکده
        const hub = new PIXI.Graphics();
        hub.circle(0, 0, 46);
        hub.fill({ color: 0x2b1d10 });
        hub.stroke({ width: 4, color: 0xffcc00 });
        hub.x = centerX;
        hub.y = centerY;
        app.stage.addChild(hub);

        const hubLabel = new PIXI.Text({
            text: villageInfo?.is_capital ? `👑\n${villageInfo?.name || ''}` : (villageInfo?.name || ''),
            style: { fontFamily: 'Tahoma, Arial', fontSize: 12, fill: 0xffcc00, align: 'center', fontWeight: 'bold' },
        });
        hubLabel.anchor.set(0.5);
        hubLabel.x = centerX;
        hubLabel.y = centerY;
        app.stage.addChild(hubLabel);

        const glowRings = [];

        centerBuildings.forEach((b, i) => {
            const angle = (i / centerBuildings.length) * Math.PI * 2 - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            const container = new PIXI.Container();
            container.x = x;
            container.y = y;
            container.eventMode = 'static';
            container.cursor = 'pointer';

            const color = CATEGORY_COLORS[b.category] ?? 0x8899aa;

            const circle = new PIXI.Graphics();
            circle.circle(0, 0, 48);
            circle.fill({ color });
            circle.stroke({ width: 3, color: 0x1a1a1a });
            container.addChild(circle);

            if (b.is_upgrading) {
                const ring = new PIXI.Graphics();
                ring.circle(0, 0, 56);
                ring.stroke({ width: 3, color: 0xffd54a });
                container.addChild(ring);
                glowRings.push(ring);
            }

            const nameText = new PIXI.Text({
                text: b.name,
                style: { fontFamily: 'Tahoma, Arial', fontSize: 11, fill: 0xffffff, align: 'center', fontWeight: 'bold', wordWrap: true, wordWrapWidth: 84 },
            });
            nameText.anchor.set(0.5, 1);
            nameText.y = -6;
            container.addChild(nameText);

            const levelText = new PIXI.Text({
                text: `Lv.${b.level}`,
                style: { fontFamily: 'Tahoma, Arial', fontSize: 14, fill: 0xffcc00, fontWeight: 'bold' },
            });
            levelText.anchor.set(0.5, 0);
            levelText.y = 4;
            container.addChild(levelText);

            container.on('pointerover', () => { container.alpha = 0.85; container.scale.set(1.05); });
            container.on('pointerout', () => { container.alpha = 1; container.scale.set(1); });
            container.on('pointerdown', () => setSelected(b));

            app.stage.addChild(container);
        });

        if (glowRings.length > 0) {
            const tickerFn = () => {
                const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 220);
                glowRings.forEach((ring) => { ring.alpha = 0.4 + pulse * 0.6; });
            };
            tickerFnRef.current = tickerFn;
            app.ticker.add(tickerFn);
        }
    }, [centerBuildings, villageInfo]);

    const handleUpgrade = async () => {
        if (!selected || !activeVillageId) return;
        setUpgrading(true);
        try {
            const response = await api.post('game/upgrade-building/', {
                village_id: activeVillageId,
                position: selected.position,
            });
            alert(response.data.message);
            setSelected(null);
            fetchBuildings();
        } catch (error) {
            alert(error.response?.data?.error || "خطا در ارتقای ساختمان");
        } finally {
            setUpgrading(false);
        }
    };

    const canAfford = (building) => {
        if (!villageInfo) return false;
        const r = villageInfo.resources;
        const c = building.next_level_cost;
        return r.wood >= c.wood && r.clay >= c.clay && r.iron >= c.iron && r.crop >= c.crop;
    };

    return (
        <div className="w-full min-h-screen bg-[#c2d69b] flex flex-col items-center pt-32 pb-10">
            <ResourceBar />
            <Navbar />

            {loading ? (
                <p className="font-bold text-[#3d2b1a] mt-10">در حال بارگذاری دهکده...</p>
            ) : (
                <>
                    <div
                        className="shadow-2xl border-[12px] border-[#593d2b] rounded-lg overflow-hidden relative bg-black"
                        ref={pixiContainerRef}
                        style={{ width: '620px', height: '460px', maxWidth: '95vw' }}
                    />

                    <div className="bg-[#f4ebd0] border-4 border-[#593d2b] rounded-lg shadow-xl mt-6 p-4 max-w-3xl w-full">
                        <h3 className="font-bold text-[#593d2b] mb-3 text-center">🌾 مزارع منابع</h3>
                        <div className="grid grid-cols-6 gap-2">
                            {resourceFields.map((field) => (
                                <button
                                    key={field.id}
                                    onClick={() => setSelected(field)}
                                    className={`relative flex flex-col items-center justify-center h-16 rounded border-2 transition
                                        ${field.is_upgrading ? 'border-yellow-500 bg-yellow-100 animate-pulse' : 'border-[#a9835a] bg-[#e9d9b8] hover:bg-[#dfc89e]'}`}
                                >
                                    <span className="text-lg">{resourceIcon(field.name)}</span>
                                    <span className="text-[10px] font-bold text-[#593d2b]">Lv.{field.level}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {selected && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4">
                    <div className="bg-[#f4ebd0] border-4 border-[#593d2b] rounded-xl shadow-2xl max-w-sm w-full p-6">
                        <h3 className="text-xl font-bold text-[#593d2b] mb-1">
                            {resourceIcon(selected.name)} {selected.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">سطح فعلی: <span className="font-bold">{selected.level}</span></p>

                        {selected.is_upgrading ? (
                            <div className="bg-yellow-100 border border-yellow-400 rounded p-3 text-center mb-4">
                                <p className="text-sm font-bold text-yellow-800 mb-1">در حال ارتقا...</p>
                                <p className="font-mono text-lg font-bold text-yellow-900" dir="ltr">
                                    {formatDuration(remainingSeconds(selected.upgrade_end_time) - Math.floor((now - now) / 1000))}
                                </p>
                            </div>
                        ) : (
                            <div className="bg-white/60 rounded border p-3 mb-4 text-sm">
                                <p className="font-bold text-[#593d2b] mb-2">هزینه ارتقا به سطح {selected.level + 1}:</p>
                                <div className="grid grid-cols-2 gap-1 text-xs font-bold">
                                    <span>🪵 چوب: {selected.next_level_cost.wood}</span>
                                    <span>🧱 خشت: {selected.next_level_cost.clay}</span>
                                    <span>⚒️ آهن: {selected.next_level_cost.iron}</span>
                                    <span>🌾 گندم: {selected.next_level_cost.crop}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    زمان ساخت: {formatDuration(selected.next_level_time_seconds)}
                                </p>
                                {!canAfford(selected) && (
                                    <p className="text-xs text-red-600 font-bold mt-2">منابع کافی برای این ارتقا ندارید.</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelected(null)}
                                className="flex-1 bg-gray-300 text-gray-800 p-2 rounded font-bold hover:bg-gray-400"
                            >
                                بستن
                            </button>
                            <button
                                onClick={handleUpgrade}
                                disabled={selected.is_upgrading || upgrading || !canAfford(selected)}
                                className="flex-1 bg-[#593d2b] text-white p-2 rounded font-bold hover:bg-[#4a3224] disabled:bg-gray-400"
                            >
                                {upgrading ? "..." : "ارتقا 🔨"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}