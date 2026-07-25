import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";
import '../styles/VillageCenter.css';

const SLOT_POSITIONS = {
    19: { left: 265, top: 120, size: 95 },
    20: { left: 205, top: 45,  size: 95 },
    21: { left: 110, top: 90,  size: 95 },
    22: { left: 290, top: 45,  size: 95 },
    23: { left: 370, top: 50, size: 95 },
    25: { left: 434, top: 104, size: 95 },
    27: { left: 458, top: 210, size: 95 },
    28: { left: 500, top: 260, size: 95 },
    29: { left: 260, top: 356, size: 95 },
    30: { left: 65, top: 260, size: 95 },
    31: { left: 60, top: 135, size: 95 },
    32: { left: 175, top: 145, size: 95 },
    33: { left: 150, top: 185, size: 95 },
    34: { left: 500, top: 160, size: 95 },
    35: { left: 40, top: 200, size: 95 },
    36: { left: 160, top: 325, size: 95 },
    37: { left: 330, top: 335, size: 95 },
    38: { left: 250, top: 265, size: 95 },
    39: { left: 370, top: 213, size: 95 },
    40: { left: 10, top: 10, size: 10 }
};

const NAME_TO_GID = {
    'چوب‌بری': 1, 'گودال خاک رس': 2,
    'معدن آهن': 3, 'مزرعه گندم': 4,
    'اره‌خانه': 5, 'کوره آجرپزی': 6,
    'کوره آهنگری': 7, 'آسیاب': 8,
    'نانوایی': 9, 'انبار': 10,
    'سیلوی غله': 11, 'آهنگری': 12,
    'زره‌خانه': 13, 'میدان تورنمنت': 14,
    'ساختمان اصلی': 15, 'محل گردهمایی': 16,
    'بازارچه': 17, 'سفارتخانه': 18,
    'پادگان': 19, 'اصطبل': 20,
    'کارگاه': 21, 'آکادمی': 22,
    'مخفیگاه': 23, 'تالار شهر': 24,
    'اقامتگاه': 25, 'قصر': 26,
    'خزانه‌داری': 27,
    'اداره تجارت': 28,
    'پادگان بزرگ': 29,
    'اصطبل بزرگ': 30,
    'دیوار شهر': 31, 'دیوار خاکی': 32,
    'حصار چوبی': 33, 'تله': 34,
    'عمارت قهرمان': 35,
    'آبشخور اسب': 38,
    'کارگاه سنگ‌تراشی': 41,
    'شگفتی جهان': 40,
};

const WALL_TRIBE_GID = { ROMAN: 31, TEUTON: 32, GAUL: 33 };

function getGid(name) {
    if (!name) return null;
    if (NAME_TO_GID[name] !== undefined) return NAME_TO_GID[name];
    for (const [key, val] of Object.entries(NAME_TO_GID)) {
        if (name.includes(key) || key.includes(name)) return val;
    }
    return null;
}

function formatCountdown(seconds) {
    if (!seconds || seconds <= 0) return null;
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m}:${s}`;
    if (m > 0) return `${m}:${s}`;
    return `${s}s`;
}

export default function VillageCenter() {
    const navigate = useNavigate();
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const user = useGameStore((state) => state.user);
    const { lastMessage } = useGameWebSocket();

    const [villageInfo, setVillageInfo] = useState(null);
    const [buildings, setBuildings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [upgrading, setUpgrading] = useState(false);
    const [hoveredSlot, setHoveredSlot] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [showLevels, setShowLevels] = useState(() => localStorage.getItem('village2_levels') === '1');

    // Building selection state
    const [showBuildList, setShowBuildList] = useState(false);
    const [buildSlot, setBuildSlot] = useState(null);
    const [availableBuildings, setAvailableBuildings] = useState([]);
    const [buildListLoading, setBuildListLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchBuildings = useCallback(async () => {
        if (!activeVillageId) { setLoading(false); return; }
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/buildings/`);
            setVillageInfo(data.village);
            setBuildings(data.buildings);
        } catch (error) {
            console.error('error fetching village', error);
        } finally { setLoading(false); }
    }, [activeVillageId]);

    const fetchAvailableBuildings = useCallback(async (slot) => {
        if (!activeVillageId) return;
        setBuildListLoading(true);
        try {
            const { data } = await api.get(`game/villages/${activeVillageId}/available-buildings/`);
            setAvailableBuildings(data.buildings || []);
            setBuildSlot(slot);
            setShowBuildList(true);
        } catch (error) {
            console.error('error fetching available buildings', error);
        } finally { setBuildListLoading(false); }
    }, [activeVillageId]);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        fetchBuildings();
        return () => controller.abort();
    }, [fetchBuildings, activeVillageId]);

    useEffect(() => {
        const interval = setInterval(() => {
            fetchBuildings();
        }, 30000);
        return () => clearInterval(interval);
    }, [fetchBuildings]);

    useEffect(() => { if (lastMessage?.type === 'building_completed') fetchBuildings(); }, [lastMessage, fetchBuildings]);

    const handleUpgrade = async () => {
        if (!selectedSlot || !activeVillageId) return;
        setUpgrading(true);
        try {
            await api.post('game/upgrade-building/', { village_id: activeVillageId, position: selectedSlot.position });
            setSelectedSlot(null);
            fetchBuildings();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در ارتقا');
        } finally { setUpgrading(false); }
    };

    const handleBuild = async (buildingTypeId) => {
        if (!buildSlot || !activeVillageId) return;
        setUpgrading(true);
        try {
            await api.post('game/upgrade-building/', {
                village_id: activeVillageId,
                position: buildSlot.position,
                building_type_id: buildingTypeId
            });
            setShowBuildList(false);
            setBuildSlot(null);
            fetchBuildings();
        } catch (error) {
            alert(error.response?.data?.error || 'خطا در ساخت ساختمان');
        } finally { setUpgrading(false); }
    };

    const canAfford = (b) => {
        if (!villageInfo || !b?.next_level_cost) return false;
        const r = villageInfo.resources, c = b.next_level_cost;
        return r.wood >= c.wood && r.clay >= c.clay && r.iron >= c.iron && r.crop >= c.crop;
    };

    const canAffordCost = (cost) => {
        if (!villageInfo || !cost) return false;
        const r = villageInfo.resources;
        return r.wood >= cost.wood && r.clay >= cost.clay && r.iron >= cost.iron && r.crop >= cost.crop;
    };

    const toggleLevels = () => {
        const n = !showLevels;
        setShowLevels(n);
        if (n) localStorage.setItem('village2_levels', '1');
        else localStorage.removeItem('village2_levels');
    };

    const cityBuildings = buildings.filter(b => b.position >= 19 && b.position <= 40);
    const bMap = {};
    cityBuildings.forEach(b => { bMap[b.position] = b; });
    const wallB = bMap[40], rallyB = bMap[39], tribe = user?.tribe || 'ROMAN';

    const getImg = (b) => {
        if (!b) return null;
        if (b.level === 0 && !b.is_upgrading) {
            return '/assets/buildings/iso.gif';
        }
        const gid = getGid(b.name);
        if (!gid) return '/assets/buildings/iso.gif';
        return `/assets/buildings/g${gid}${b.is_upgrading ? 'b' : ''}.png`;
    };

    const isEmpty = (b) => b && b.level === 0 && !b.is_upgrading;

    const handleSlotClick = (b) => {
        if (isEmpty(b)) {
            fetchAvailableBuildings(b);
        } else {
            setSelectedSlot(b);
        }
    };

    const filteredBuildings = availableBuildings.filter(b =>
        !searchQuery || b.name.includes(searchQuery)
    );

    const getBuildingImg = (btName) => {
        const gid = getGid(btName);
        return gid ? `/assets/buildings/g${gid}.png` : '/assets/buildings/iso.gif';
    };

    return (
        <div className='village2-container'>
            <div id='village_map'>
                {loading ? <p className='village-loading'>در حال بارگذاری دهکده...</p> : (
                    <>
                        {cityBuildings.filter(b => b.position >= 19 && b.position <= 38).map(b => {
                            const pos = SLOT_POSITIONS[b.position];
                            const img = getImg(b);
                            if (!pos || !img) return null;
                            return (
                                <img
                                    key={b.id || b.position}
                                    src={img}
                                    alt={b.name}
                                    onClick={() => handleSlotClick(b)}
                                    onMouseEnter={(e) => { setHoveredSlot(b); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                    onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                    onMouseLeave={() => setHoveredSlot(null)}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                    className='slot-building-img'
                                    style={{ left: `${pos.left}px`, top: `${pos.top}px`, maxWidth: `${pos.size}px`, maxHeight: `${pos.size}px` }}
                                />
                            );
                        })}

                        {rallyB && (() => {
                            const pos = SLOT_POSITIONS[39];
                            const g = rallyB.is_upgrading ? 'g16b' : (rallyB.level > 0 ? 'g16' : 'g16e');
                            return (
                                <img
                                    key='rally'
                                    src={`/assets/buildings/${g}.png`}
                                    alt={rallyB.name}
                                    onClick={() => handleSlotClick(rallyB)}
                                    onMouseEnter={(e) => { setHoveredSlot(rallyB); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                    onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                    onMouseLeave={() => setHoveredSlot(null)}
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                    className='rally-building-img'
                                    style={{ left: `${pos.left}px`, top: `${pos.top}px`, width: `${pos.size}px` }}
                                />
                            );
                        })()}

                        {wallB && (wallB.level > 0 || wallB.is_upgrading) && (() => {
                            const wl = wallB.level || 0;
                            const maxLvl = wallB.max_level || 20;
                            const t = Math.min(wl / maxLvl, 1);
                            const brightness = 1 + t * 0.3;
                            const saturate = 1 + t * 0.8;
                            const wallFilter = `brightness(${brightness}) saturate(${saturate})`;
                            return (
                                <>
                                    <img
                                        key='wall-top'
                                        className='wall-top'
                                        src={`/assets/buildings/g${WALL_TRIBE_GID[tribe] || 31}Top.png`}
                                        style={{ filter: wallFilter }}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                    <img
                                        key='wall-bottom'
                                        className='wall-bottom'
                                        src={`/assets/buildings/g${WALL_TRIBE_GID[tribe] || 31}${wallB.is_upgrading ? 'bBottom' : 'Bottom'}.png`}
                                        style={{ filter: wallFilter }}
                                        onClick={() => handleSlotClick(wallB)}
                                        onMouseEnter={(e) => { setHoveredSlot(wallB); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                        onMouseLeave={() => setHoveredSlot(null)}
                                        onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                </>
                            );
                        })()}

                        {/* ناحیه کلیک شفاف برای دیوار خالی */}
                        {wallB && wallB.level === 0 && !wallB.is_upgrading && (
                            <div
                                key='wall-click'
                                className='wall-click-area'
                                onClick={() => handleSlotClick(wallB)}
                                onMouseEnter={(e) => { setHoveredSlot(wallB); setTooltipPos({ x: e.clientX, y: e.clientY }); }}
                                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                onMouseLeave={() => setHoveredSlot(null)}
                            />
                        )}

                        {showLevels && wallB && wallB.level > 0 && (
                            <div
                                key='wall-lvl'
                                onClick={() => setSelectedSlot(wallB)}
                                className={`wall-level-badge ${wallB.is_upgrading ? 'upgrading' : 'normal'}`}
                            >
                                {wallB.level}
                            </div>
                        )}

                        {showLevels && cityBuildings.filter(b => b.level > 0 && b.position !== 40).map(b => {
                            const pos = SLOT_POSITIONS[b.position];
                            if (!pos) return null;
                            const up = b.is_upgrading;
                            return (
                                <div
                                    key={`lvl-${b.position}`}
                                    onClick={() => setSelectedSlot(b)}
                                    className={`building-level-badge ${up ? 'upgrading' : 'normal'}`}
                                    style={{ left: `${pos.left + 14}px`, top: `${pos.top - 14}px` }}
                                >
                                    {b.level}
                                </div>
                            );
                        })}

                        <div
                            onClick={toggleLevels}
                            className={`level-toggle-btn ${showLevels ? 'active' : 'inactive'}`}
                        >
                            {showLevels ? '−' : '+'}
                        </div>
                    </>
                )}
            </div>

            {/* Tooltip */}
            {hoveredSlot && !showBuildList && (
                <div className='building-tooltip' style={{ left: tooltipPos.x + 15, top: tooltipPos.y - 10 }}>
                    <div className='tooltip-title'>{hoveredSlot.name}</div>
                    {isEmpty(hoveredSlot) ? (
                        <div className='tooltip-empty'>محل ساخت - کلیک کنید</div>
                    ) : (
                        <div>سطح فعلی: <b className='tooltip-level-value'>{hoveredSlot.level}</b></div>
                    )}
                    {hoveredSlot.is_upgrading && <div className='tooltip-upgrading'>در حال ارتقا...</div>}
                    {!hoveredSlot.is_upgrading && !hoveredSlot.is_max_level && hoveredSlot.next_level_cost && (
                        <>
                            <div className='tooltip-cost-title'>هزینه {isEmpty(hoveredSlot) ? 'ساخت' : 'ارتقا'} به سطح {hoveredSlot.level + 1}:</div>
                            <div className='tooltip-cost-grid'>
                                <span><img src='/assets/ui/res-1.gif' width='12' alt='' /> {hoveredSlot.next_level_cost.wood}</span>
                                <span><img src='/assets/ui/res-2.gif' width='12' alt='' /> {hoveredSlot.next_level_cost.clay}</span>
                                <span><img src='/assets/ui/res-3.gif' width='12' alt='' /> {hoveredSlot.next_level_cost.iron}</span>
                                <span><img src='/assets/ui/res-4.gif' width='12' alt='' /> {hoveredSlot.next_level_cost.crop}</span>
                            </div>
                        </>
                    )}
                    {hoveredSlot.is_max_level && <div className='tooltip-max-level'>حداکثر سطح</div>}
                </div>
            )}

            {/* Upgrade Modal */}
            {selectedSlot && (
                <div className='modal-overlay'>
                    <div className='modal-card'>
                        <div className='modal-header'>
                            <span className='modal-title'>{selectedSlot.name}</span>
                            <button onClick={() => setSelectedSlot(null)} className='modal-close-btn'>&#10006;</button>
                        </div>
                        <div className='modal-body'>
                            <p className='level-info-text'>سطح فعلی: <span style={{ fontWeight: 'bold', color: '#73b544' }}>{selectedSlot.level}</span></p>
                            {selectedSlot.is_upgrading ? (
                                <div className='upgrading-box'>
                                    <p className='upgrading-box-text'>در حال ارتقا...</p>
                                </div>
                            ) : selectedSlot.is_max_level ? (
                                <div className='max-level-box'>
                                    <p className='max-level-box-text'>این ساختمان به حداکثر سطح رسیده است.</p>
                                </div>
                            ) : (
                                <div className='upgrade-cost-box'>
                                    <p className='cost-title'>هزینه ارتقا به سطح {selectedSlot.level + 1}:</p>
                                    <div className='resource-grid'>
                                        <span className='res-item'><img src='/assets/ui/res-1.gif' width='14' alt='' /> {selectedSlot.next_level_cost.wood}</span>
                                        <span className='res-item'><img src='/assets/ui/res-2.gif' width='14' alt='' /> {selectedSlot.next_level_cost.clay}</span>
                                        <span className='res-item'><img src='/assets/ui/res-3.gif' width='14' alt='' /> {selectedSlot.next_level_cost.iron}</span>
                                        <span className='res-item'><img src='/assets/ui/res-4.gif' width='14' alt='' /> {selectedSlot.next_level_cost.crop}</span>
                                    </div>
                                    <p className='build-time'>زمان ساخت: <span style={{ fontWeight: 'bold' }}>{formatDuration(selectedSlot.next_level_time_seconds)}</span></p>
                                    {!canAfford(selectedSlot) && <p className='insufficient-res'>منابع کافی ندارید.</p>}
                                </div>
                            )}
                            <button
                                onClick={handleUpgrade}
                                disabled={selectedSlot.is_upgrading || upgrading || selectedSlot.is_max_level || !canAfford(selectedSlot)}
                                className='btn-primary-action'
                            >
                                {upgrading ? 'صبر کنید...' : `ارتقا به سطح ${selectedSlot.level + 1}`}
                            </button>

                            {selectedSlot.level > 0 && (() => {
                                const navMap = {
                                    'آکادمی': '/academy',
                                    'پادگان': '/barracks',
                                    'آهنگری': '/blacksmith',
                                    'سفارتخانه': '/embassy',
                                    'تالار شهر': '/town-hall',
                                    'اقامتگاه': '/residence',
                                    'ساختمان اصلی': '/main-building',
                                    'عمارت قهرمان': '/hero',
                                    'بازارچه': '/marketplace',
                                    'محل گردهمایی': '/movements',
                                    'مخفیگاه': '/hideout',
                                    'تله': '/trapper',
                                    'قصر': '/palace',
                                    'انبار': '/warehouse',
                                    'سیلوی غله': '/warehouse',
                                    'کارگاه سنگ‌تراشی': '/stonemason',
                                    'دیوار شهر': '/wall',
                                    'دیوار خاکی': '/wall',
                                    'حصار چوبی': '/wall',
                                };
                                const target = navMap[selectedSlot.name];
                                if (!target) return null;
                                return (
                                    <button
                                        onClick={() => { setSelectedSlot(null); navigate(target); }}
                                        className='btn-nav-special'
                                    >
                                        رفتن به صفحه {selectedSlot.name}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Building Selection Modal for empty slots */}
            {showBuildList && (
                <div className='modal-overlay'>
                    <div className='modal-card wide'>
                        <div className='modal-header green'>
                            <span className='modal-title white'>ساختمان قابل ساخت</span>
                            <button
                                onClick={() => { setShowBuildList(false); setBuildSlot(null); setSearchQuery(''); }}
                                className='modal-close-btn white'
                            >
                                &#10006;
                            </button>
                        </div>
                        <div className='search-container'>
                            <input
                                type='text'
                                placeholder='جستجو در نام ساختمان...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className='search-input-field'
                            />
                        </div>
                        <div className='building-list-scroll'>
                            {buildListLoading ? (
                                <p style={{ textAlign: 'center', color: '#666' }}>در حال بارگذاری...</p>
                            ) : filteredBuildings.length === 0 ? (
                                <p style={{ textAlign: 'center', color: '#666' }}>ساختمانی یافت نشد.</p>
                            ) : (
                                filteredBuildings.map(bt => (
                                    <div
                                        key={bt.building_type_id}
                                        className={`building-card-item ${bt.can_build ? 'can-build' : 'cannot-build'}`}
                                    >
                                        <img
                                            src={getBuildingImg(bt.name)}
                                            alt={bt.name}
                                            className='building-card-img'
                                            onError={(e) => { e.target.src = '/assets/buildings/iso.gif'; }}
                                        />
                                        <div className='building-card-details'>
                                            <div className='building-card-title'>{bt.name}</div>
                                            <div className='building-card-resources'>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><img src='/assets/ui/res-1.gif' width='10' alt='' /> {bt.cost.wood}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><img src='/assets/ui/res-2.gif' width='10' alt='' /> {bt.cost.clay}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><img src='/assets/ui/res-3.gif' width='10' alt='' /> {bt.cost.iron}</span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><img src='/assets/ui/res-4.gif' width='10' alt='' /> {bt.cost.crop}</span>
                                                <span style={{ color: '#666' }}>زمان: {formatCountdown(bt.build_time_seconds)}</span>
                                            </div>
                                            {bt.reason && <div className='building-card-reason'>✖ {bt.reason}</div>}
                                            {bt.can_build && (
                                                <button
                                                    onClick={() => handleBuild(bt.building_type_id)}
                                                    disabled={upgrading || !canAffordCost(bt.cost)}
                                                    className='btn-build-action'
                                                >
                                                    {upgrading ? 'صبر کنید...' : 'ساخت'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}