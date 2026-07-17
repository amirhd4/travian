import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';

const RADIUS = 2;

export default function WorldMap() {
    const navigate = useNavigate();
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    const [center, setCenter] = useState({ x: 0, y: 0 });
    const [mapVillages, setMapVillages] = useState([]);
    const [oases, setOases] = useState([]);
    const [selectedOasis, setSelectedOasis] = useState(null);
    const [oasisTroops, setOasisTroops] = useState({});
    const [availableTroops, setAvailableTroops] = useState([]);
    const [attackingOasis, setAttackingOasis] = useState(false);
    const [oasisAlert, setOasisAlert] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeVillageId) return;
        api.get('combat/village-troops/', { params: { village_id: activeVillageId } })
            .then(({ data }) => setAvailableTroops(data)).catch(() => {});
    }, [activeVillageId]);

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
                const oasesRes = await api.get('game/oases/', { params: { x: center.x, y: center.y, radius: RADIUS } });
                setOases(oasesRes.data);
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
            const oasis = oases.find((o) => o.x_coord === x && o.y_coord === y);
            grid.push({
                x, y, hasVillage: !!found,
                name: found ? found.name : null,
                owner: found ? found.owner : null,
                isNatar: found ? found.is_natar : false,
                isMine: found ? found.id === activeVillageId : false,
                id: found ? found.id : null,
                isWwSite: found ? found.is_natar_ww_site : false,
                isPlanGuard: found ? found.is_natar_plan_guard : false,
                oasis,
                isArtifactSite: found ? found.is_natar_artifact_site : false,
            });
        }
    }

    const handleCellClick = (cell) => {
        if (cell.oasis) { setSelectedOasis(cell.oasis); return; }
        if (cell.hasVillage && !cell.isMine) {
            navigate('/send-troops', { state: { targetVillageId: cell.id, targetName: cell.name } });
        }
    };

    const handleOasisAttack = async () => {
        const payload = Object.fromEntries(Object.entries(oasisTroops).filter(([, v]) => v > 0));
        if (Object.keys(payload).length === 0 || !activeVillageId) return;
        setAttackingOasis(true);
        try {
            const { data } = await api.post('game/oases/attack/', {
                village_id: activeVillageId, oasis_id: selectedOasis.id, troops_payload: payload,
            });
            setOasisAlert(data.message);
            setSelectedOasis(null);
            setOasisTroops({});
        } catch (error) {
            setOasisAlert(error.response?.data?.error || 'خطا در حمله به اوسیس');
        } finally {
            setAttackingOasis(false);
        }
    };

    // Get tile image based on cell type (matching PHP map tiles)
    const getTileStyle = (cell) => {
        if (cell.oasis) {
            return cell.oasis.is_free
                ? { background: 'url(/assets/map/oasis-1.gif) center/cover', border: '1px solid #5a8a3a' }
                : { background: 'url(/assets/map/oasis-2.gif) center/cover', border: '1px solid #3a6a2a' };
        }
        if (cell.isMine) return { background: 'url(/assets/map/tribe-1.gif) center/contain no-repeat, #e8e0d0', border: '2px solid #d4a017' };
        if (cell.hasVillage) return { background: 'url(/assets/map/tribe-2.gif) center/contain no-repeat, #e8e0d0', border: '1px solid #8b7355' };
        if (cell.isNatar) return { background: 'url(/assets/map/tribe-5.gif) center/contain no-repeat, #e8e0d0', border: '1px solid #cc3333' };
        if (cell.isWwSite) return { background: '#f0e8ff', border: '1px solid #9966cc' };
        if (cell.isArtifactSite) return { background: '#e8f8ff', border: '1px solid #6699cc' };
        return { background: '#f5f0e8', border: '1px solid #d4c8b0' };
    };

    return (
        <div className="map">
            <div id="mapContainer" style={{ position: 'relative', width: '543px', height: '401px', margin: '0 auto', border: '1px solid #636363', background: '#C3EDAE' }}>
                {loading ? (
                    <p style={{ padding: '20px', textAlign: 'center', fontWeight: 'bold' }}>در حال بارگذاری نقشه...</p>
                ) : (
                    <>
                        {/* Map grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0', width: '100%', height: '100%' }}>
                            {grid.map((cell, index) => (
                                <div
                                    key={index}
                                    onClick={() => handleCellClick(cell)}
                                    style={{
                                        ...getTileStyle(cell),
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: cell.hasVillage || cell.oasis ? 'pointer' : 'default',
                                        position: 'relative',
                                        padding: '2px',
                                    }}
                                >
                                    {cell.oasis ? (
                                        <>
                                            <img src="/assets/map/oasis-1.gif" alt="oasis" style={{ width: '24px', height: '24px' }} />
                                            <span style={{ fontSize: '8px', fontWeight: 'bold', color: '#333' }}>[{cell.x}|{cell.y}]</span>
                                        </>
                                    ) : cell.hasVillage ? (
                                        <>
                                            <span style={{ fontSize: '10px', fontWeight: 'bold', color: cell.isMine ? '#006600' : '#333', textAlign: 'center' }}>
                                                {cell.name}
                                            </span>
                                            {cell.owner && !cell.isNatar && !cell.isMine && (
                                                <span style={{ fontSize: '8px', color: '#666' }}>{cell.owner}</span>
                                            )}
                                        </>
                                    ) : (
                                        <span style={{ fontSize: '8px', color: '#999' }}>[{cell.x}|{cell.y}]</span>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Coordinate ruler */}
                        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', height: '18px', background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
                            <span style={{ color: '#FFF', fontSize: '10px', fontWeight: 'bold' }}>
                                {center.x - RADIUS}|{center.y + RADIUS} تا {center.x + RADIUS}|{center.y - RADIUS}
                            </span>
                        </div>
                    </>
                )}
            </div>

            {/* Navigation controls */}
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
                <button onClick={() => setCenter(c => ({ ...c, y: c.y + 1 }))} className="btn-ghost" style={{ margin: '2px' }}>▲</button>
                <div style={{ display: 'inline-flex', gap: '2px' }}>
                    <button onClick={() => setCenter(c => ({ ...c, x: c.x - 1 }))} className="btn-ghost" style={{ margin: '2px' }}>◄</button>
                    <button onClick={() => setCenter(c => ({ ...c, x: c.x + 1 }))} className="btn-ghost" style={{ margin: '2px' }}>►</button>
                </div>
                <button onClick={() => setCenter(c => ({ ...c, y: c.y - 1 }))} className="btn-ghost" style={{ margin: '2px' }}>▼</button>
            </div>

            {/* Legend */}
            <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '10px', color: '#252525' }}>
                <span style={{ margin: '0 8px' }}>● <span style={{ color: '#006600' }}>دهکده من</span></span>
                <span style={{ margin: '0 8px' }}>● <span style={{ color: '#8b7355' }}>بازیکن دیگر</span></span>
                <span style={{ margin: '0 8px' }}>● <span style={{ color: '#cc3333' }}>ناتار</span></span>
                <span style={{ margin: '0 8px' }}>● <span style={{ color: '#9966cc' }}>شگفتی جهان</span></span>
                <span style={{ margin: '0 8px' }}>● <span style={{ color: '#5a8a3a' }}>اوسیس</span></span>
            </div>

            {/* Oasis attack modal */}
            {selectedOasis && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ background: '#FFF', border: '2px solid #C9C9C9', maxWidth: '400px', width: '100%', padding: '16px' }}>
                        <h3 style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>اوسیس ({selectedOasis.x_coord}|{selectedOasis.y_coord})</h3>
                        <p style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
                            بونوس: {selectedOasis.bonus_percent}٪ {selectedOasis.bonus_resource} · قدرت دفاعی: {selectedOasis.defense_strength}
                        </p>
                        {oasisAlert && <p style={{ fontSize: '11px', fontWeight: 'bold', color: '#228B22', marginBottom: '8px' }}>{oasisAlert}</p>}
                        <div style={{ maxHeight: '200px', overflow: 'auto', marginBottom: '8px' }}>
                            {availableTroops.map((t) => (
                                <div key={t.troop_type_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', padding: '4px 0', borderBottom: '1px solid #EEE' }}>
                                    <span>{t.name} (موجود: {t.count})</span>
                                    <input type="number" min="0" max={t.count} className="text" style={{ width: '60px', textAlign: 'center' }}
                                        value={oasisTroops[t.troop_type_id] || ''}
                                        onChange={(e) => setOasisTroops((p) => ({ ...p, [t.troop_type_id]: Math.max(0, Math.min(t.count, parseInt(e.target.value) || 0)) }))} />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleOasisAttack} disabled={attackingOasis} className="btn-danger" style={{ width: '100%', marginBottom: '8px' }}>
                            {attackingOasis ? '...' : 'حمله به اوسیس (فوری)'}
                        </button>
                        <button onClick={() => setSelectedOasis(null)} className="btn-ghost" style={{ width: '100%' }}>بستن</button>
                    </div>
                </div>
            )}
        </div>
    );
}
