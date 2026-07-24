import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { useGameWebSocket } from '../hooks/useGameWebsocket';
import { formatDuration } from "../utils/formatter.js";

const SLOT_POSITIONS = {
    19: { left: 265, top: 120, size: 95 },
    20: { left: 205, top: 45,  size: 95 },
    21: { left: 110, top: 90,  size: 95 },
    22: { left: 290, top: 45,  size: 95 },
    23: { left: 370, top: 50, size: 95 },
    // 24: { left: 380, top: 54, size: 95 },
    25: { left: 434, top: 104, size: 95 },
    // 26: { left: 490, top: 155, size: 95 },
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
        <div className='village2' style={{ display:'flex', justifyContent:'center', margin:'20px auto' }}>
            <div id='village_map' style={{ position:'relative', width:'540px', height:'448px', backgroundImage:'url(/assets/map/village_bg.jpg)', backgroundSize:'contain', backgroundRepeat:'no-repeat', backgroundPosition:'center', margin:'0 auto', overflow:'visible' }}>
                {loading ? <p style={{ fontWeight:'bold', paddingTop:200, color:'#252525', textAlign:'center' }}>در حال بارگذاری دهکده...</p> : (
                    <>
                        {cityBuildings.filter(b => b.position >= 19 && b.position <= 38).map(b => {
                            const pos = SLOT_POSITIONS[b.position];
                            const img = getImg(b);
                            if (!pos || !img) return null;
                            return <img key={b.id||b.position} src={img} alt={b.name} onClick={()=>handleSlotClick(b)} onMouseEnter={(e)=>{setHoveredSlot(b);setTooltipPos({x:e.clientX,y:e.clientY})}} onMouseMove={(e)=>setTooltipPos({x:e.clientX,y:e.clientY})} onMouseLeave={()=>setHoveredSlot(null)} onError={(e)=>{e.target.style.display='none'}} style={{ position:'absolute', left:`${pos.left}px`, top:`${pos.top}px`, maxWidth:`${pos.size}px`, maxHeight:`${pos.size}px`, transform:'translate(-50%,-50%)', cursor:'pointer', zIndex:10, filter:'drop-shadow(0px 2px 3px rgba(0,0,0,0.4))' }} />;
                        })}

                        {rallyB && (() => {
                            const pos = SLOT_POSITIONS[39];
                            const g = rallyB.is_upgrading ? 'g16b' : (rallyB.level > 0 ? 'g16' : 'g16e');
                            return <img key='rally' src={`/assets/buildings/${g}.png`} alt={rallyB.name} onClick={()=>handleSlotClick(rallyB)} onMouseEnter={(e)=>{setHoveredSlot(rallyB);setTooltipPos({x:e.clientX,y:e.clientY})}} onMouseMove={(e)=>setTooltipPos({x:e.clientX,y:e.clientY})} onMouseLeave={()=>setHoveredSlot(null)} onError={(e)=>{e.target.style.display='none'}} style={{ position:'absolute', left:`${pos.left}px`, top:`${pos.top}px`, width:`${pos.size}px`, transform:'translate(-50%,-50%) scaleX(-1)', cursor:'pointer', zIndex:11 }} />;
                        })()}

                        {wallB && (wallB.level > 0 || wallB.is_upgrading) && (() => {
                            const wl = wallB.level || 0;
                            const maxLvl = wallB.max_level || 20;
                            const t = Math.min(wl / maxLvl, 1);
                            const brightness = 1 + t * 0.3;
                            const saturate = 1 + t * 0.8;
                            const glowRadius = Math.round(t * 8);
                            const wallFilter = `brightness(${brightness}) saturate(${saturate})`;
                            const glowShadow = glowRadius > 0 ? `0 0 ${glowRadius}px rgba(255,215,0,${0.15 + t * 0.35})` : 'none';
                            return (
                                <>
                                    <img key='wall-top' className='wall-top'
                                        src={`/assets/buildings/g${WALL_TRIBE_GID[tribe]||31}Top.png`}
                                        style={{ position:'absolute', left:0, top:0,
                                                 zIndex:14, pointerEvents:'none',
                                                 filter: wallFilter, transform: 'scaleX(-1)'
                                    }}
                                        onError={(e)=>{e.target.style.display='none'}}
                                    />
                                    <img key='wall-bottom' className='wall-bottom'
                                        src={`/assets/buildings/g${WALL_TRIBE_GID[tribe]||31}${wallB.is_upgrading ? 'bBottom' : 'Bottom'}.png`}
                                        style={{ position:'absolute', left:0, top:0,
                                                 zIndex:39, pointerEvents:'none',
                                                 filter: wallFilter,
                                                 boxShadow: glowShadow, transform: 'scaleX(-1)' }}
                                        onClick={()=>handleSlotClick(wallB)}
                                        onMouseEnter={(e)=>{setHoveredSlot(wallB);setTooltipPos({x:e.clientX,y:e.clientY})}}
                                        onMouseMove={(e)=>setTooltipPos({x:e.clientX,y:e.clientY})}
                                        onMouseLeave={()=>setHoveredSlot(null)}
                                        onError={(e)=>{e.target.style.display='none'}}
                                    />
                                </>
                            );
                        })()}

                        {/* ✅ ناحیه کلیک شفاف برای دیوار خالی (موقعیت ۴۰) */}
                        {wallB && wallB.level === 0 && !wallB.is_upgrading && (
                            <div key='wall-click'
                                onClick={()=>handleSlotClick(wallB)}
                                onMouseEnter={(e)=>{setHoveredSlot(wallB);setTooltipPos({x:e.clientX,y:e.clientY})}}
                                onMouseMove={(e)=>setTooltipPos({x:e.clientX,y:e.clientY})}
                                onMouseLeave={()=>setHoveredSlot(null)}
                                style={{ position:'absolute', left:'-7.5%', top:'-7.5%', width:'115%', height:'115%',
                                         zIndex:5, cursor:'pointer', pointerEvents:'all' }}
                            />
                        )}

                        {showLevels && wallB && wallB.level > 0 && (
                            <div key='wall-lvl' onClick={()=>setSelectedSlot(wallB)}
                                style={{ position:'absolute', left:'50%', top:'-5%', transform:'translate(-50%,-50%)',
                                         background: wallB.is_upgrading ? 'linear-gradient(to top,#c9940a,#fce2a8)' : 'linear-gradient(to top,#7da100,#c7e94f)',
                                         border:`1px solid ${wallB.is_upgrading ? '#f88c1f' : '#506d00'}`,
                                         color: wallB.is_upgrading ? '#a65a12' : '#252525',
                                         borderRadius:3, padding:'1px 6px', fontSize:12, fontWeight:'bold', zIndex:40,
                                         cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.5)' }}>
                                {wallB.level}
                            </div>
                        )}

                        {showLevels && cityBuildings.filter(b => b.level > 0 && b.position !== 40).map(b => {
                            const pos = SLOT_POSITIONS[b.position];
                            if (!pos) return null;
                            const up = b.is_upgrading;
                            return <div key={`lvl-${b.position}`} onClick={()=>setSelectedSlot(b)} style={{ position:'absolute', left:`${pos.left+14}px`, top:`${pos.top-14}px`, transform:'translate(-50%,-50%)', background: up?'linear-gradient(to top,#c9940a,#fce2a8)':'linear-gradient(to top,#7da100,#c7e94f)', border:`1px solid ${up?'#f88c1f':'#506d00'}`, color:up?'#a65a12':'#252525', borderRadius:3, padding:'1px 4px', fontSize:11, fontWeight:'bold', zIndex:30, cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.5)' }}>{b.level}</div>;
                        })}

                        <div onClick={toggleLevels} style={{ position:'absolute', right:10, bottom:10, background:showLevels?'#c9940a':'#7da100', color:'#FFF', width:22, height:22, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontWeight:'bold', zIndex:40, userSelect:'none' }}>{showLevels?'−':'+'}</div>
                    </>
                )}
            </div>

            {hoveredSlot && !showBuildList && <div style={{ position:'fixed', left:tooltipPos.x+15, top:tooltipPos.y-10, background:'rgba(0,0,0,0.85)', color:'#FFF', padding:'8px 12px', borderRadius:6, fontSize:12, zIndex:200, pointerEvents:'none', minWidth:150, lineHeight:'18px', boxShadow:'0 2px 8px rgba(0,0,0,0.4)', direction:'rtl', fontFamily:'Tahoma,Arial,sans-serif' }}>
                <div style={{ fontWeight:'bold', fontSize:13, marginBottom:4, borderBottom:'1px solid rgba(255,255,255,0.3)', paddingBottom:4 }}>{hoveredSlot.name}</div>
                {isEmpty(hoveredSlot) ? <div style={{ color:'#F88C1F', marginTop:4 }}>محل ساخت - کلیک کنید</div> : <div>سطح فعلی: <b style={{ color:'#99C01A' }}>{hoveredSlot.level}</b></div>}
                {hoveredSlot.is_upgrading && <div style={{ color:'#F88C1F', marginTop:4 }}>در حال ارتقا...</div>}
                {!hoveredSlot.is_upgrading && !hoveredSlot.is_max_level && hoveredSlot.next_level_cost && <>
                    <div style={{ marginTop:4, fontSize:11, color:'#CCC' }}>هزینه {isEmpty(hoveredSlot)?'ساخت':'ارتقا'} به سطح {hoveredSlot.level+1}:</div>
                    <div style={{ display:'flex', gap:8, marginTop:2, fontSize:11 }}>
                        <span><img src='/assets/ui/res-1.gif' width='12' alt='' style={{ verticalAlign:'middle' }} /> {hoveredSlot.next_level_cost.wood}</span>
                        <span><img src='/assets/ui/res-2.gif' width='12' alt='' style={{ verticalAlign:'middle' }} /> {hoveredSlot.next_level_cost.clay}</span>
                        <span><img src='/assets/ui/res-3.gif' width='12' alt='' style={{ verticalAlign:'middle' }} /> {hoveredSlot.next_level_cost.iron}</span>
                        <span><img src='/assets/ui/res-4.gif' width='12' alt='' style={{ verticalAlign:'middle' }} /> {hoveredSlot.next_level_cost.crop}</span>
                    </div></>}
                {hoveredSlot.is_max_level && <div style={{ color:'#99C01A', marginTop:4 }}>حداکثر سطح</div>}
            </div>}

            {/* Upgrade Modal for existing buildings */}
            {selectedSlot && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}><div style={{ background:'#FFF', border:'2px solid #C9C9C9', borderRadius:8, maxWidth:400, width:'100%', position:'relative', overflow:'hidden', boxShadow:'0 8px 16px rgba(0,0,0,0.3)' }}>
                <div style={{ background:'#f8f8f8', padding:'12px 16px', borderBottom:'1px solid #ddd', display:'flex', justifyContent:'space-between', alignItems:'center' }}><span style={{ fontWeight:'bold', fontSize:15 }}>{selectedSlot.name}</span><button onClick={()=>setSelectedSlot(null)} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#888' }}>&#10006;</button></div>
                <div style={{ padding:16 }}>
                    <p style={{ fontSize:14, marginBottom:16, color:'#333' }}>سطح فعلی: <span style={{ fontWeight:'bold', color:'#73b544' }}>{selectedSlot.level}</span></p>
                    {selectedSlot.is_upgrading ? <div style={{ padding:12, textAlign:'center', marginBottom:16, background:'#fff3cd', border:'1px solid #ffeeba', borderRadius:4 }}><p style={{ fontSize:14, fontWeight:'bold', color:'#856404', margin:0 }}>در حال ارتقا...</p></div>
                    : selectedSlot.is_max_level ? <div style={{ padding:12, textAlign:'center', marginBottom:16, background:'#d4edda', border:'1px solid #c3e6cb', borderRadius:4 }}><p style={{ fontSize:14, fontWeight:'bold', color:'#155724', margin:0 }}>این ساختمان به حداکثر سطح رسیده است.</p></div>
                    : <div style={{ padding:16, marginBottom:16, fontSize:13, background:'#fdfdfd', border:'1px solid #eee', borderRadius:4 }}>
                        <p style={{ fontWeight:'bold', marginBottom:12, color:'#444' }}>هزینه ارتقا به سطح {selectedSlot.level+1}:</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, fontSize:12, fontWeight:'bold', marginBottom:16, color:'#222' }}>
                            <span style={{ display:'flex', alignItems:'center', gap:4 }}><img src='/assets/ui/res-1.gif' width='14' alt='' /> {selectedSlot.next_level_cost.wood}</span>
                            <span style={{ display:'flex', alignItems:'center', gap:4 }}><img src='/assets/ui/res-2.gif' width='14' alt='' /> {selectedSlot.next_level_cost.clay}</span>
                            <span style={{ display:'flex', alignItems:'center', gap:4 }}><img src='/assets/ui/res-3.gif' width='14' alt='' /> {selectedSlot.next_level_cost.iron}</span>
                            <span style={{ display:'flex', alignItems:'center', gap:4 }}><img src='/assets/ui/res-4.gif' width='14' alt='' /> {selectedSlot.next_level_cost.crop}</span>
                        </div>
                        <p style={{ fontSize:12, color:'#666', margin:0 }}>زمان ساخت: <span style={{ fontWeight:'bold' }}>{formatDuration(selectedSlot.next_level_time_seconds)}</span></p>
                        {!canAfford(selectedSlot) && <p style={{ fontSize:12, fontWeight:'bold', marginTop:12, color:'#dc3545', textAlign:'center' }}>منابع کافی ندارید.</p>}
                    </div>}
                    <button onClick={handleUpgrade} disabled={selectedSlot.is_upgrading||upgrading||selectedSlot.is_max_level||!canAfford(selectedSlot)} style={{ width:'100%', padding:10, background:(selectedSlot.is_upgrading||upgrading||selectedSlot.is_max_level||!canAfford(selectedSlot))?'#ccc':'#73b544', color:'#fff', border:'none', borderRadius:4, fontWeight:'bold', cursor:(selectedSlot.is_upgrading||upgrading||selectedSlot.is_max_level||!canAfford(selectedSlot))?'not-allowed':'pointer' }}>
                        {upgrading ? 'صبر کنید...' : `ارتقا به سطح ${selectedSlot.level+1}`}
                    </button>
                    {/* Navigation links for special buildings */}
                    {selectedSlot.level > 0 && (() => {
                        const navMap = {
                            'آکادمی': '/academy',
                            'پادگان': '/barracks',
                            'آهنگری': '/blacksmith',
                            'سفارتخانه': '/embassy',
                        };
                        const target = navMap[selectedSlot.name];
                        if (!target) return null;
                        return (
                            <button onClick={() => { setSelectedSlot(null); navigate(target); }} style={{ width:'100%', padding:8, marginTop:8, background:'#498843', color:'#fff', border:'none', borderRadius:4, fontWeight:'bold', cursor:'pointer', fontSize:12 }}>
                                رفتن به صفحه {selectedSlot.name}
                            </button>
                        );
                    })()}
                </div></div></div>}

            {/* Building Selection Modal for empty slots */}
            {showBuildList && <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}><div style={{ background:'#FFF', border:'2px solid #C9C9C9', borderRadius:8, maxWidth:700, width:'100%', maxHeight:'80vh', position:'relative', overflow:'hidden', boxShadow:'0 8px 16px rgba(0,0,0,0.3)' }}>
                <div style={{ background:'#498843', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}><span style={{ fontWeight:'bold', fontSize:15, color:'#FFF' }}>ساختمان قابل ساخت</span><button onClick={()=>{setShowBuildList(false);setBuildSlot(null);setSearchQuery('');}} style={{ background:'transparent', border:'none', cursor:'pointer', fontSize:18, color:'#FFF' }}>&#10006;</button></div>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid #eee' }}>
                    <input type='text' placeholder='جستجو در نام ساختمان...' value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} style={{ width:'100%', padding:'8px 12px', border:'1px solid #ccc', borderRadius:4, fontSize:13, direction:'rtl', boxSizing:'border-box' }} />
                </div>
                <div style={{ padding:16, overflowY:'auto', maxHeight:'calc(80vh - 120px)' }}>
                    {buildListLoading ? <p style={{ textAlign:'center', color:'#666' }}>در حال بارگذاری...</p> : filteredBuildings.length === 0 ? <p style={{ textAlign:'center', color:'#666' }}>ساختمانی یافت نشد.</p> : filteredBuildings.map(bt => (
                        <div key={bt.building_type_id} style={{ display:'flex', gap:12, padding:'12px', marginBottom:8, border:bt.can_build?'1px solid #99C01A':'1px solid #ddd', borderRadius:6, background:bt.can_build?'#f9fbe7':'#f9f9f9', opacity:bt.can_build?1:0.7, transition:'all 0.2s' }}>
                            <img src={getBuildingImg(bt.name)} alt={bt.name} style={{ width:60, height:60, objectFit:'contain', borderRadius:4, background:'#fff', border:'1px solid #eee', flexShrink:0 }} onError={(e)=>{e.target.src='/assets/buildings/iso.gif'}} />
                            <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontWeight:'bold', fontSize:14, color:'#333', marginBottom:4 }}>{bt.name}</div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:6, fontSize:11, marginBottom:4 }}>
                                    <span style={{ display:'flex', alignItems:'center', gap:2 }}><img src='/assets/ui/res-1.gif' width='10' alt='' /> {bt.cost.wood}</span>
                                    <span style={{ display:'flex', alignItems:'center', gap:2 }}><img src='/assets/ui/res-2.gif' width='10' alt='' /> {bt.cost.clay}</span>
                                    <span style={{ display:'flex', alignItems:'center', gap:2 }}><img src='/assets/ui/res-3.gif' width='10' alt='' /> {bt.cost.iron}</span>
                                    <span style={{ display:'flex', alignItems:'center', gap:2 }}><img src='/assets/ui/res-4.gif' width='10' alt='' /> {bt.cost.crop}</span>
                                    <span style={{ color:'#666' }}>زمان: {formatCountdown(bt.build_time_seconds)}</span>
                                </div>
                                {bt.reason && <div style={{ fontSize:11, color:'#c00', marginBottom:4 }}>✖ {bt.reason}</div>}
                                {bt.can_build && <button onClick={()=>handleBuild(bt.building_type_id)} disabled={upgrading||!canAffordCost(bt.cost)} style={{ padding:'4px 16px', background:(!canAffordCost(bt.cost)||upgrading)?'#ccc':'#73b544', color:'#fff', border:'none', borderRadius:4, fontWeight:'bold', fontSize:12, cursor:(!canAffordCost(bt.cost)||upgrading)?'not-allowed':'pointer' }}>{upgrading?'صبر کنید...':'ساخت'}</button>}
                            </div>
                        </div>
                    ))}
                </div>
            </div></div>}
        </div>
    );
}
