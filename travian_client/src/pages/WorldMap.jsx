import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { MAP } from '../constants/images';

const RADIUS = 4;
const COLS = 9;
const ROWS = 7;
const TILE_SIZE = 60;
const OASIS_CAPTURE_MAX_DISTANCE = 10;

const FIELD_DISTRIBUTIONS = {
  1: '3-3-3-9', 2: '3-4-5-6', 3: '4-4-4-6', 4: '4-5-3-6',
  5: '5-3-4-6', 6: '1-1-1-15', 7: '4-4-3-7', 8: '3-4-4-7',
  9: '4-3-4-7', 10: '3-5-4-6', 11: '4-3-5-6', 12: '5-4-3-6',
};

const OASIS_BONUS_LABELS = {
  'wood': '🪵 چوب', 'clay': '🧱 خشت', 'iron': '⚒️ آهن', 'crop': '🌾 گندم',
};

const TERRAIN_COLORS = ['#a8d5a2', '#9cc99a', '#b5deb0', '#a0d49a', '#b8e0b2', '#8fc48a', '#a5d8a0', '#95c890'];

function getTileBgPattern(x, y) {
  let pattern = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const cx = x + c - 1;
      const cy = y - r + 1;
      const dist = Math.sqrt(cx * cx + cy * cy);
      pattern += dist <= 6.5 ? '1' : '0';
    }
  }
  return pattern;
}

function isVolcanoTile(x, y) {
  return x >= -2 && x <= 2 && y >= -2 && y <= 1;
}

function getVolcanoClass(x, y) {
  const volcanoMap = {
    '-1,1': 'volcano1', '0,1': 'volcano2', '1,1': 'volcano3',
    '-2,0': 'volcano4', '-1,0': 'volcano5', '0,0': 'volcano6',
    '1,0': 'volcano7', '2,0': 'volcano8',
    '-2,-1': 'volcano9', '-1,-1': 'volcano10', '0,-1': 'volcano11',
    '1,-1': 'volcano12', '2,-1': 'volcano13',
    '-2,-2': 'volcano14', '-1,-2': 'volcano15', '0,-2': 'volcano16',
    '1,-2': 'volcano17', '2,-2': 'volcano18',
  };
  return volcanoMap[`${x},${y}`] || null;
}

function getTerrainColor(x, y) {
  const idx = ((x * 7 + y * 13) & 0x7fffffff) % TERRAIN_COLORS.length;
  return TERRAIN_COLORS[idx];
}

function getEmptySlotFieldType(x, y) {
  const hash = ((x * 2654435761) ^ (y * 2246822519)) & 0x7fffffff;
  return (hash % 9) + 1;
}

function BonusBadge({ resource, percent }) {
  const colors = { wood: '#4a7c3f', clay: '#b87333', iron: '#666', crop: '#daa520' };
  return (
    <span style={{ display: 'inline-block', padding: '2px 8px', margin: '2px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', background: colors[resource] || '#888', color: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
      {OASIS_BONUS_LABELS[resource] || resource} {percent}%
    </span>
  );
}

// کامپوننت کمکی برای راهنمای نقشه
function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', padding: '4px 10px', borderRadius: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', fontSize: 11, fontWeight: 'bold', color: '#444' }}>
      <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: color, border: '1px solid rgba(0,0,0,0.1)' }}></span>
      {label}
    </div>
  );
}

export default function WorldMap() {
  const navigate = useNavigate();
  const villages = useGameStore((s) => s.villages);
  const activeVillageId = useGameStore((state) => state.activeVillageId);
  const activeVillage = villages.find((v) => v.id === activeVillageId);

  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [mapVillages, setMapVillages] = useState([]);
  const [oases, setOases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredTile, setHoveredTile] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedTile, setSelectedTile] = useState(null);
  const [positionDetail, setPositionDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [coordInput, setCoordInput] = useState({ x: '', y: '' });
  const [selectedOasis, setSelectedOasis] = useState(null);
  const [oasisTroops, setOasisTroops] = useState({});
  const [availableTroops, setAvailableTroops] = useState([]);
  const [attackingOasis, setAttackingOasis] = useState(false);
  const [oasisAlert, setOasisAlert] = useState(null);
  const [centerReady, setCenterReady] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!activeVillageId) return;
    api.get('combat/village-troops/', { params: { village_id: activeVillageId } })
      .then(({ data }) => setAvailableTroops(data)).catch(() => {});
  }, [activeVillageId]);

  useEffect(() => {
    const av = villages.find((v) => v.id === activeVillageId);
    if (av) {
      setCenter({ x: av.x_coord, y: av.y_coord });
      setCoordInput({ x: String(av.x_coord), y: String(av.y_coord) });
      setCenterReady(true);
    }
  }, [villages, activeVillageId]);

  const fetchMap = useCallback(async () => {
    setLoading(true);
    try {
      const [vRes, oRes] = await Promise.all([
        api.get('game/world-map/', { params: { x: center.x, y: center.y, radius: RADIUS } }),
        api.get('game/oases/', { params: { x: center.x, y: center.y, radius: RADIUS } }),
      ]);
      setMapVillages(vRes.data);
      setOases(oRes.data);
    } catch (e) {
      console.error('Map fetch error', e);
    } finally {
      setLoading(false);
    }
  }, [center]);

  useEffect(() => { if (centerReady) fetchMap(); }, [fetchMap, centerReady]);

  const buildGrid = () => {
    const grid = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = center.x - Math.floor(COLS / 2) + col;
        const y = center.y + Math.floor(ROWS / 2) - row;
        const village = mapVillages.find((v) => v.x_coord === x && v.y_coord === y);
        const oasis = oases.find((o) => o.x_coord === x && o.y_coord === y);
        const isNatarCenter = isVolcanoTile(x, y);
        const volcanoClass = getVolcanoClass(x, y);
        const isGrayTile = Math.sqrt(x * x + y * y) <= 6.5;

        let fieldType = 0;
        let oasisType = 0;
        if (oasis) {
          oasisType = oasis.oasis_type || 1;
        } else if (village) {
          fieldType = village.field_type || 0;
        } else if (!isNatarCenter) {
          fieldType = getEmptySlotFieldType(x, y);
        }

        let distance = null;
        if (activeVillage) {
          distance = Math.sqrt((x - activeVillage.x_coord) ** 2 + (y - activeVillage.y_coord) ** 2);
        }

        const isMine = village ? village.id === activeVillageId : false;

        grid.push({
          x, y, row, col, village, oasis,
          isNatarCenter, volcanoClass, isGrayTile,
          fieldType, oasisType, distance,
          isMine,
          isNatar: village ? village.is_natar : false,
          isWwSite: village ? village.is_natar_ww_site : false,
          isArtifactSite: village ? village.is_natar_artifact_site : false,
          isEmptySlot: !village && !oasis && !isNatarCenter,
        });
      }
    }
    return grid;
  };

  const getBorderClass = (cell) => {
    if (!cell.village) return 'borderneutr';
    if (cell.isMine) return 'borderown';
    if (cell.isNatar) return 'borderatwar';
    return 'borderneutr';
  };

  const handleTileClick = async (cell) => {
    if (cell.oasis) {
      setSelectedOasis(cell.oasis);
      return;
    }
    setSelectedTile(cell);
    setDetailLoading(true);
    try {
      const { data } = await api.get('game/position-details/', { params: { x: cell.x, y: cell.y } });
      setPositionDetail(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTileHover = (cell, e) => {
    setHoveredTile(cell);
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  const handleCoordSubmit = (e) => {
    e.preventDefault();
    const nx = parseInt(coordInput.x, 10);
    const ny = parseInt(coordInput.y, 10);
    if (!isNaN(nx) && !isNaN(ny)) {
      setCenter({ x: nx, y: ny });
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
      fetchMap();
    } catch (error) {
      setOasisAlert(error.response?.data?.error || 'خطا در حمله');
    } finally {
      setAttackingOasis(false);
    }
  };

  const handleFoundVillage = () => {
    if (!positionDetail) return;
    navigate('/colonize', { state: { targetX: positionDetail.x_coord, targetY: positionDetail.y_coord } });
  };

  const grid = buildGrid();

  const renderTile = (cell) => {
    const { x, y, village, oasis, isNatarCenter, volcanoClass, isGrayTile, isMine, isNatar, isEmptySlot, fieldType } = cell;

    let bgColor = getTerrainColor(x, y);
    if (isGrayTile) bgColor = '#9aa59d';

    let tileBgPattern = '';
    if (isGrayTile && !isNatarCenter) {
      tileBgPattern = getTileBgPattern(x, y);
    }

    const borderClass = getBorderClass(cell);
    const wallLevel = village ? Math.min(village.wall_level || 0, 5) : 0;
    const pop = village ? (village.population || 0) : 0;
    const hasVillage = !!village;
    const hasOasis = !!oasis;

    return (
      <div
        key={`${x},${y}`}
        className="tile"
        onClick={() => handleTileClick(cell)}
        onMouseEnter={(e) => handleTileHover(cell, e)}
        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => setHoveredTile(null)}
        style={{
          background: bgColor,
          cursor: 'pointer',
          overflow: 'hidden',
          position: 'relative',
          transition: 'transform 0.1s',
        }}
      >
        {isGrayTile && !isNatarCenter && tileBgPattern && (
          <img src={MAP.getTileBg(tileBgPattern)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}
        {isNatarCenter && volcanoClass && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', backgroundImage: `url(${MAP.volcano})`, backgroundPosition: `0 ${-(parseInt(volcanoClass.replace('volcano', '')) - 1) * 60}px`, backgroundRepeat: 'no-repeat' }} />
        )}
        {isEmptySlot && !isGrayTile && fieldType > 0 && (
          <img src={MAP.getTerrain(fieldType)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}
        {hasOasis && cell.oasisType > 0 && (
          <img src={oasis.is_free ? MAP.getOasisTile(cell.oasisType) : MAP.getOasisOccupied(cell.oasisType)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}
        {hasOasis && oasis.is_free && (
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 10px rgba(0,200,0,0.4)', animation: 'oasisPulse 3s ease-in-out infinite', pointerEvents: 'none' }} />
        )}
        {hasOasis && !oasis.is_free && (
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 8px rgba(255,180,0,0.5)', pointerEvents: 'none' }} />
        )}
        {hasVillage && (
          <img src={MAP.getBorder(borderClass)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}
        {hasVillage && wallLevel > 0 && (
          <img src={MAP.getWall(wallLevel)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}
        {hasVillage && pop > 0 && (
          <img src={MAP.getPop(pop)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}
        {hasVillage && village.has_incoming_attack && (
          <img src={MAP.att1} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}
        {hasOasis && oasis.nature_troops?.length > 0 && (
          <div style={{ position: 'absolute', top: 2, left: 2, fontSize: 7, background: 'rgba(139,69,19,0.9)', color: '#fff', borderRadius: 4, padding: '2px 4px', pointerEvents: 'none', fontWeight: 'bold', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
            {oasis.nature_troops.reduce((s, t) => s + t.count, 0).toLocaleString()}
          </div>
        )}
        {hasVillage && (
          <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', color: isMine ? '#004d00' : isNatar ? '#a10000' : '#222', textShadow: '1px 1px 2px #fff, -1px -1px 2px #fff, 1px -1px 2px #fff, -1px 1px 2px #fff', lineHeight: '12px', maxWidth: 58, margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {village.name}
            </div>
          </div>
        )}
        {isEmptySlot && !isGrayTile && (
          <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 9, color: '#444', textShadow: '0 0 3px rgba(255,255,255,0.8)', opacity: 0.7, fontWeight: 'bold' }}>
              خالی
            </div>
          </div>
        )}
      </div>
    );
  };

  const xCoords = [];
  for (let i = 0; i < COLS; i++) xCoords.push(center.x - Math.floor(COLS / 2) + i);
  const yCoords = [];
  for (let i = 0; i < ROWS; i++) yCoords.push(center.y + Math.floor(ROWS / 2) - i);

  return (
    <div className="map" style={{ direction: 'rtl', padding: '20px', fontFamily: 'Tahoma, Arial, sans-serif' }}>

      {/* Search Coordinates - Modern Form */}
      <form onSubmit={handleCoordSubmit} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 15, background: '#fff', padding: '12px 24px', borderRadius: 30, boxShadow: '0 4px 12px rgba(0,0,0,0.06)', width: 'fit-content', margin: '0 auto 25px auto', border: '1px solid #eef0f2' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 'bold', color: '#555' }}>X:</span>
          <input type="text" value={coordInput.x} onChange={(e) => setCoordInput((p) => ({ ...p, x: e.target.value }))} style={{ width: 60, textAlign: 'center', border: '2px solid #e0e0e0', borderRadius: 8, padding: '6px', fontSize: 14, direction: 'ltr', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 'bold', color: '#555' }}>Y:</span>
          <input type="text" value={coordInput.y} onChange={(e) => setCoordInput((p) => ({ ...p, y: e.target.value }))} style={{ width: 60, textAlign: 'center', border: '2px solid #e0e0e0', borderRadius: 8, padding: '6px', fontSize: 14, direction: 'ltr', outline: 'none' }} />
        </div>
        <button type="submit" style={{ background: '#498843', color: '#fff', border: 'none', borderRadius: 20, padding: '8px 24px', cursor: 'pointer', fontWeight: 'bold', fontSize: 13, boxShadow: '0 2px 6px rgba(73,136,67,0.4)', transition: 'background 0.2s' }}>پرش به مختصات</button>
      </form>

      {/* Main Map Area with Rulers */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '10px auto' }}>
        <div style={{ position: 'relative', background: '#f5f7f9', padding: '15px 35px 35px 15px', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', display: 'inline-block', border: '1px solid #e1e4e8' }}>

          {/* Y-axis ruler (Right side) */}
          <div style={{ position: 'absolute', right: 0, top: 15, width: 35, background: '#2c3e50', borderRadius: '0 12px 12px 0', paddingBottom: 2 }}>
            {yCoords.map((yc) => (
              <div key={yc} style={{ height: TILE_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 'bold', color: '#ecf0f1' }}>{yc}</div>
            ))}
          </div>

          {/* Map container */}
          <div ref={mapRef} style={{ position: 'relative', width: COLS * TILE_SIZE, height: ROWS * TILE_SIZE, border: '3px solid #2c3e50', borderRadius: 6, background: '#C3EDAE', overflow: 'hidden', zIndex: 2 }}>
            {loading ? (
              <div style={{ padding: 100, textAlign: 'center', fontWeight: 'bold', fontSize: 15, color: '#444' }}>در حال بارگذاری نقشه...</div>
            ) : (
              <div style={{ width: '100%', height: '100%' }}>
                {grid.map((cell) => renderTile(cell))}
              </div>
            )}
          </div>

          {/* X-axis ruler (Bottom side) */}
          <div style={{ position: 'absolute', bottom: 0, left: 15, width: COLS * TILE_SIZE, display: 'flex', background: '#2c3e50', borderRadius: '0 0 12px 12px', paddingRight: 3 }}>
            {xCoords.map((xc) => (
              <div key={xc} style={{ width: TILE_SIZE, textAlign: 'center', fontSize: 11, fontWeight: 'bold', color: '#ecf0f1', padding: '6px 0' }}>{xc}</div>
            ))}
          </div>

        </div>
      </div>

      {/* Navigation Controls (D-Pad / Steering Wheel style) */}
      <div style={{ position: 'relative', width: 140, height: 140, margin: '30px auto', background: '#eef2f5', borderRadius: '50%', boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.05), 0 4px 10px rgba(0,0,0,0.1)', border: '4px solid #fff' }}>
        <button onClick={() => setCenter((c) => ({ ...c, y: c.y + 1 }))} style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', background: '#498843', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', fontSize: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
        <button onClick={() => setCenter((c) => ({ ...c, y: c.y - 1 }))} style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: '#498843', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', fontSize: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
        <button onClick={() => setCenter((c) => ({ ...c, x: c.x - 1 }))} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', background: '#498843', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', fontSize: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>◄</button>
        <button onClick={() => setCenter((c) => ({ ...c, x: c.x + 1 }))} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: '#498843', color: '#fff', border: 'none', borderRadius: '50%', width: 44, height: 44, cursor: 'pointer', fontSize: 18, boxShadow: '0 2px 6px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>►</button>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 36, height: 36, background: '#dce2e8', borderRadius: '50%', boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.1)' }} />
      </div>

      {/* Legend - Badges Style */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, margin: '30px auto', maxWidth: 800, padding: '16px', background: '#f8f9fa', borderRadius: 16, border: '1px solid #eaeaea' }}>
        <LegendItem color="#006600" label="دهکده من" />
        <LegendItem color="#8b7355" label="بازیکن دیگر" />
        <LegendItem color="#cc3333" label="ناتار" />
        <LegendItem color="#9966cc" label="شگفتی جهان" />
        <LegendItem color="#5a8a3a" label="آبادی آزاد" />
        <LegendItem color="#3a6a2a" label="آبادی اشغال‌شده" />
        <LegendItem color="#7a9a6a" label="خانه خالی" />
      </div>

      {/* Hover tooltip (Modernized) */}
      {hoveredTile && (
        <div style={{
          position: 'fixed', left: tooltipPos.x + 15, top: tooltipPos.y - 10,
          background: 'rgba(25, 30, 36, 0.95)', color: '#FFF', padding: '12px 16px',
          borderRadius: 8, fontSize: 12, zIndex: 200, pointerEvents: 'none',
          minWidth: 180, lineHeight: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          direction: 'rtl', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {hoveredTile.village ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: 6, color: '#f1c40f' }}>
                {hoveredTile.village.name}
              </div>
              <div style={{ color: '#bdc3c7' }}>مختصات: ({hoveredTile.y}|{hoveredTile.x})</div>
              <div>بازیکن: <span style={{ fontWeight: 'bold' }}>{hoveredTile.village.owner}</span></div>
              {hoveredTile.village.tribe && <div>قبیله: {hoveredTile.village.tribe}</div>}
              {hoveredTile.village.alliance_id && <div>اتحاد: #{hoveredTile.village.alliance_id}</div>}
              <div>جمعیت: {hoveredTile.village.population?.toLocaleString()}</div>
              {hoveredTile.village.wall_level > 0 && <div>دیوار: سطح {hoveredTile.village.wall_level}</div>}
              {hoveredTile.village.is_capital && <div style={{ color: '#e67e22', marginTop: 4, fontWeight: 'bold' }}>⭐ پایتخت</div>}
              {hoveredTile.isMine && <div style={{ color: '#2ecc71', marginTop: 4, fontWeight: 'bold' }}>✓ دهکده شما</div>}
            </>
          ) : hoveredTile.oasis ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 6, color: '#2ecc71' }}>🌴 آبادی</div>
              <div style={{ color: '#bdc3c7', marginBottom: 4 }}>مختصات: ({hoveredTile.y}|{hoveredTile.x})</div>
              <div style={{ margin: '6px 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {hoveredTile.oasis.bonuses?.map((b, i) => (
                  <span key={i} style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{OASIS_BONUS_LABELS[b[0]] || b[0]} {b[1]}%</span>
                )) || <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{OASIS_BONUS_LABELS[hoveredTile.oasis.bonus_resource]} {hoveredTile.oasis.bonus_percent}%</span>}
              </div>
              <div>دفاع: {hoveredTile.oasis.defense_strength}</div>
              {hoveredTile.oasis.nature_troops?.length > 0 && (
                <div style={{ marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 6 }}>
                  {hoveredTile.oasis.nature_troops.map((t, i) => (
                    <div key={i} style={{ fontSize: 11, color: '#e0e0e0' }}>- {t.name}: {t.count}</div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 6, fontWeight: 'bold' }}>{hoveredTile.oasis.is_free ? 'آزاد' : `مالک: ${hoveredTile.oasis.owner_name}`}</div>
              {hoveredTile.distance != null && (
                <div style={{ color: hoveredTile.distance > OASIS_CAPTURE_MAX_DISTANCE ? '#e74c3c' : '#2ecc71', marginTop: 4 }}>
                  فاصله: {hoveredTile.distance.toFixed(1)} {hoveredTile.distance > OASIS_CAPTURE_MAX_DISTANCE ? '(خارج از محدوده)' : ''}
                </div>
              )}
            </>
          ) : hoveredTile.isEmptySlot ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 14, marginBottom: 6, color: '#95a5a6' }}>موقعیت خالی</div>
              <div style={{ color: '#bdc3c7' }}>مختصات: ({hoveredTile.y}|{hoveredTile.x})</div>
              {hoveredTile.fieldType > 0 && FIELD_DISTRIBUTIONS[hoveredTile.fieldType] && (
                <div style={{ marginTop: 4, color: '#2ecc71', fontSize: 11 }}>منابع: {FIELD_DISTRIBUTIONS[hoveredTile.fieldType]}</div>
              )}
              <div style={{ marginTop: 6, color: '#7f8c8d', fontSize: 11 }}>برای تاسیس دهکده کلیک کنید</div>
            </>
          ) : (
            <div>({hoveredTile.y}|{hoveredTile.x})</div>
          )}
        </div>
      )}

      {/* Position details popup (Modal styles refined) */}
      {selectedTile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#FFF', borderRadius: 12, maxWidth: 420, width: '100%', maxHeight: '85vh', overflow: 'hidden', boxShadow: '0 12px 30px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ background: '#f8f9fa', padding: '14px 20px', borderBottom: '1px solid #eaeaea', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: 16, color: '#333' }}>جزئیات موقعیت</span>
              <button onClick={() => { setSelectedTile(null); setPositionDetail(null); }} style={{ background: '#f1f3f5', border: 'none', cursor: 'pointer', fontSize: 16, color: '#666', width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>&#10006;</button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto' }}>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: '#888' }}>
                  <div style={{ marginBottom: 10 }}>⏳</div>
                  در حال دریافت اطلاعات...
                </div>
              ) : positionDetail ? (
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 12, background: '#f1f3f5', padding: '4px 10px', borderRadius: 20, display: 'inline-block' }}>مختصات: ({selectedTile.y}|{selectedTile.x})</div>
                  {positionDetail.type === 'village' && (
                    <>
                      <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#2c3e50' }}>{positionDetail.name}</h3>
                      <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr><td style={{ padding: '6px 0', color: '#666', borderBottom: '1px solid #eee' }}>بازیکن</td><td style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', textAlign: 'left' }}>{positionDetail.owner}</td></tr>
                            {positionDetail.tribe && <tr><td style={{ padding: '6px 0', color: '#666', borderBottom: '1px solid #eee' }}>قبیله</td><td style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>{positionDetail.tribe}</td></tr>}
                            {positionDetail.alliance_id && <tr><td style={{ padding: '6px 0', color: '#666', borderBottom: '1px solid #eee' }}>اتحاد</td><td style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>#{positionDetail.alliance_id}</td></tr>}
                            <tr><td style={{ padding: '6px 0', color: '#666', borderBottom: '1px solid #eee' }}>جمعیت</td><td style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', textAlign: 'left' }}>{positionDetail.population?.toLocaleString()}</td></tr>
                            {positionDetail.wall_level > 0 && <tr><td style={{ padding: '6px 0', color: '#666', borderBottom: '1px solid #eee' }}>دیوار</td><td style={{ borderBottom: '1px solid #eee', textAlign: 'left' }}>سطح {positionDetail.wall_level}</td></tr>}
                            {positionDetail.field_distribution && (
                              <tr><td style={{ padding: '6px 0', color: '#666' }}>توزیع منابع</td><td style={{ fontWeight: 'bold', color: '#27ae60', textAlign: 'left', direction: 'ltr' }}>{positionDetail.field_distribution}</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {positionDetail.is_capital && <div style={{ color: '#e67e22', fontWeight: 'bold', marginBottom: 16, background: '#fdf3e8', padding: '8px', borderRadius: 6, textAlign: 'center' }}>⭐ این دهکده پایتخت است</div>}

                      {!positionDetail.is_mine && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                          <button onClick={() => { setSelectedTile(null); setPositionDetail(null); navigate('/send-troops', { state: { targetVillageId: positionDetail.id, targetName: positionDetail.name } }); }} style={{ flex: 1, padding: '10px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 13, boxShadow: '0 2px 5px rgba(231,76,60,0.3)' }}>⚔️ ارسال نیرو</button>
                          <button onClick={() => { setSelectedTile(null); setPositionDetail(null); navigate('/marketplace', { state: { targetX: selectedTile.x, targetY: selectedTile.y } }); }} style={{ flex: 1, padding: '10px', background: '#f39c12', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 13, boxShadow: '0 2px 5px rgba(243,156,18,0.3)' }}>📦 ارسال منابع</button>
                        </div>
                      )}
                      {positionDetail.is_mine && (
                        <div style={{ marginTop: 20, padding: 12, background: '#e8f5e9', borderRadius: 6, textAlign: 'center', fontSize: 13, color: '#27ae60', border: '1px solid #c8e6c9', fontWeight: 'bold' }}>
                          این دهکده متعلق به شماست
                        </div>
                      )}
                    </>
                  )}
                  {positionDetail.type === 'oasis' && (
                    <>
                      <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#27ae60' }}>🌴 آبادی</h3>
                      <div style={{ marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {positionDetail.bonuses?.map((b, i) => (
                          <BonusBadge key={i} resource={b[0]} percent={b[1]} />
                        )) || <BonusBadge resource={positionDetail.bonus_resource} percent={positionDetail.bonus_percent} />}
                      </div>
                      <div style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr><td style={{ padding: '6px 0', color: '#666', borderBottom: '1px solid #eee' }}>قدرت دفاعی</td><td style={{ fontWeight: 'bold', borderBottom: '1px solid #eee', textAlign: 'left' }}>{positionDetail.defense_strength}</td></tr>
                            <tr><td style={{ padding: '6px 0', color: '#666' }}>وضعیت</td><td style={{ fontWeight: 'bold', textAlign: 'left' }}>{positionDetail.is_free ? <span style={{ color: '#27ae60' }}>آزاد</span> : `مالک: ${positionDetail.owner_name}`}</td></tr>
                          </tbody>
                        </table>
                      </div>

                      {positionDetail.nature_troops?.length > 0 && (
                        <div style={{ marginTop: 12, padding: 12, background: '#fdfbf7', borderRadius: 8, border: '1px solid #f0e6d2' }}>
                          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#8B4513', marginBottom: 8, borderBottom: '1px solid #f0e6d2', paddingBottom: 4 }}>نیروهای مدافع طبیعت:</div>
                          {positionDetail.nature_troops.map((t, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#5a3a1a', display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                              <span>{t.name}: <strong style={{color: '#d35400'}}>{t.count}</strong></span>
                              <span style={{ fontSize: 11, color: '#888' }}>⚔️{t.attack} 🛡️{t.defense_infantry}/{t.defense_cavalry}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {positionDetail.type === 'empty' && (
                    <>
                      <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#7f8c8d' }}>موقعیت خالی</h3>
                      <p style={{ fontSize: 13, color: '#666', marginBottom: 16, lineHeight: '1.5' }}>این قسمت از نقشه هنوز توسط بازیکنی تسخیر نشده است و آماده بنای یک دهکده جدید می‌باشد.</p>

                      {positionDetail.field_distribution && (
                        <div style={{ padding: 12, background: '#eafaf1', borderRadius: 8, marginBottom: 20, border: '1px solid #d5f5e3' }}>
                          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#27ae60' }}>توزیع منابع در این موقعیت: <span style={{ direction: 'ltr', display: 'inline-block' }}>{positionDetail.field_distribution}</span></div>
                        </div>
                      )}

                      <button onClick={handleFoundVillage} style={{ width: '100%', padding: '12px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer', fontSize: 14, boxShadow: '0 4px 10px rgba(39,174,96,0.3)', transition: 'background 0.2s' }}>
                        🏠 تاسیس دهکده جدید
                      </button>
                      <p style={{ fontSize: 11, color: '#999', marginTop: 10, textAlign: 'center' }}>* نیازمند ۳ مهاجر و امتیاز فرهنگی کافی</p>
                    </>
                  )}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#666' }}>اطلاعاتی یافت نشد.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Oasis attack modal (Refined) */}
      {selectedOasis && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(3px)' }}>
          <div style={{ background: '#FFF', borderRadius: 12, maxWidth: 420, width: '100%', boxShadow: '0 12px 30px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ background: '#c0392b', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: 16, color: '#fff' }}>⚔️ حمله به آبادی ({selectedOasis.y_coord}|{selectedOasis.x_coord})</span>
              <button onClick={() => { setSelectedOasis(null); setOasisAlert(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', opacity: 0.8 }}>&#10006;</button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ marginBottom: 12, display: 'flex', gap: 6 }}>
                {selectedOasis.bonuses?.map((b, i) => (
                  <BonusBadge key={i} resource={b[0]} percent={b[1]} />
                )) || <BonusBadge resource={selectedOasis.bonus_resource} percent={selectedOasis.bonus_percent} />}
              </div>

              <div style={{ background: '#f8f9fa', padding: 10, borderRadius: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: '#555' }}>قدرت دفاعی: <strong style={{ color: '#333' }}>{selectedOasis.defense_strength}</strong></span>
              </div>

              {selectedOasis.nature_troops?.length > 0 && (
                <div style={{ padding: 12, background: '#fdfbf7', borderRadius: 6, border: '1px solid #f0e6d2', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#8B4513', marginBottom: 6 }}>نیروهای مدافع حاضر:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {selectedOasis.nature_troops.map((t, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#5a3a1a' }}>• {t.name}: <strong>{t.count}</strong></div>
                    ))}
                  </div>
                </div>
              )}

              {oasisAlert && <div style={{ padding: 10, borderRadius: 6, fontSize: 12, fontWeight: 'bold', background: oasisAlert.includes('شکست') ? '#fdedec' : '#eafaf1', color: oasisAlert.includes('شکست') ? '#c0392b' : '#27ae60', marginBottom: 16, border: `1px solid ${oasisAlert.includes('شکست') ? '#fadbd8' : '#d5f5e3'}` }}>{oasisAlert}</div>}

              <div style={{ fontWeight: 'bold', fontSize: 13, color: '#444', marginBottom: 8 }}>انتخاب نیروهای مهاجم:</div>
              <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 20, border: '1px solid #eee', borderRadius: 6, padding: 8 }}>
                {availableTroops.map((t) => (
                  <div key={t.troop_type_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '8px', borderBottom: '1px solid #f5f5f5', background: oasisTroops[t.troop_type_id] > 0 ? '#f0f8ff' : 'transparent', transition: 'background 0.2s' }}>
                    <span style={{ color: '#333' }}>{t.name} <span style={{ color: '#888', fontSize: 11 }}>(موجود: {t.count})</span></span>
                    <input type="number" min="0" max={t.count} style={{ width: 70, textAlign: 'center', border: '1px solid #dcdcdc', borderRadius: 4, padding: '6px', outline: 'none' }}
                      value={oasisTroops[t.troop_type_id] || ''}
                      onChange={(e) => setOasisTroops((p) => ({ ...p, [t.troop_type_id]: Math.max(0, Math.min(t.count, parseInt(e.target.value) || 0)) }))} />
                  </div>
                ))}
                {availableTroops.length === 0 && <div style={{ padding: 10, textAlign: 'center', color: '#888', fontSize: 12 }}>هیچ نیرویی در دهکده موجود نیست.</div>}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={handleOasisAttack} disabled={attackingOasis || Object.values(oasisTroops).every(v => !v)} style={{ flex: 2, padding: '12px', background: (attackingOasis || Object.values(oasisTroops).every(v => !v)) ? '#bdc3c7' : '#c0392b', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 'bold', cursor: (attackingOasis || Object.values(oasisTroops).every(v => !v)) ? 'not-allowed' : 'pointer', fontSize: 13, transition: 'background 0.2s' }}>
                  {attackingOasis ? 'در حال ارسال...' : 'حمله (غارت)'}
                </button>
                <button onClick={() => { setSelectedOasis(null); setOasisAlert(null); }} style={{ flex: 1, padding: '12px', background: '#ecf0f1', color: '#555', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13, transition: 'background 0.2s' }}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}