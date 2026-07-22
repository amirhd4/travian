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

const TRIBE_MAP = { ROMAN: 1, TEUTON: 2, GAUL: 3 };
const WALL_TRIBE_GID = { ROMAN: 31, TEUTON: 32, GAUL: 33 };

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

function BonusBadge({ resource, percent }) {
  const colors = { wood: '#4a7c3f', clay: '#b87333', iron: '#666', crop: '#daa520' };
  return (
    <span style={{ display: 'inline-block', padding: '1px 6px', margin: '1px', borderRadius: 4, fontSize: 10, fontWeight: 'bold', background: colors[resource] || '#888', color: '#fff' }}>
      {OASIS_BONUS_LABELS[resource] || resource} {percent}%
    </span>
  );
}

export default function WorldMap() {
  const navigate = useNavigate();
  const villages = useGameStore((s) => s.villages);
  const activeVillageId = useGameStore((s) => s.activeVillageId);
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

  useEffect(() => { fetchMap(); }, [fetchMap]);

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
        }

        // Distance from active village
        let distance = null;
        if (activeVillage) {
          distance = Math.sqrt((x - activeVillage.x_coord) ** 2 + (y - activeVillage.y_coord) ** 2);
        }

        grid.push({
          x, y, row, col, village, oasis,
          isNatarCenter, volcanoClass, isGrayTile,
          fieldType, oasisType, distance,
          isMine: village ? village.id === activeVillageId : false,
          isNatar: village ? village.is_natar : false,
          isWwSite: village ? village.is_natar_ww_site : false,
          isArtifactSite: village ? village.is_natar_artifact_site : false,
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

  const grid = buildGrid();

  const renderTile = (cell) => {
    const { x, y, village, oasis, isNatarCenter, volcanoClass, isGrayTile, isMine, isNatar } = cell;

    let bgColor = getTerrainColor(x, y);
    if (isGrayTile) bgColor = '#9aa59d';

    let tileBgPattern = '';
    if (isGrayTile && !isNatarCenter) {
      tileBgPattern = getTileBgPattern(x, y);
    }

    const borderClass = getBorderClass(cell);
    const wallLevel = village ? (village.wall_level || 0) : 0;
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
          cursor: hasVillage || hasOasis ? 'pointer' : 'default',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Layer 1: Tile background pattern (Natar region) */}
        {isGrayTile && !isNatarCenter && tileBgPattern && (
          <img src={MAP.getTileBg(tileBgPattern)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 2: Terrain type (oasis tiles) */}
        {hasOasis && cell.oasisType > 0 && (
          <img src={MAP.getTerrain(cell.oasisType)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 3: Volcano */}
        {isNatarCenter && volcanoClass && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', backgroundImage: `url(${MAP.volcano})`, backgroundPosition: `0 ${-(parseInt(volcanoClass.replace('volcano', '')) - 1) * 60}px`, backgroundRepeat: 'no-repeat' }} />
        )}

        {/* Layer 4: Oasis overlay */}
        {hasOasis && cell.oasisType > 0 && (
          <img src={oasis.is_free ? MAP.getOasisTile(cell.oasisType) : MAP.getOasisOccupied(cell.oasisType)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 4.5: Oasis glow */}
        {hasOasis && oasis.is_free && (
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 10px rgba(0,200,0,0.4)', animation: 'oasisPulse 3s ease-in-out infinite', pointerEvents: 'none' }} />
        )}
        {hasOasis && !oasis.is_free && (
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 8px rgba(255,180,0,0.5)', pointerEvents: 'none' }} />
        )}

        {/* Layer 5: Border */}
        {hasVillage && (
          <img src={MAP.getBorder(borderClass)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 6: Wall */}
        {hasVillage && wallLevel > 0 && (
          <img src={MAP.getWall(wallLevel)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 7: Population */}
        {hasVillage && pop > 0 && (
          <img src={MAP.getPop(pop)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 8: Attack marker */}
        {hasVillage && village.has_incoming_attack && (
          <img src={MAP.att1} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Nature troop badge on oasis */}
        {hasOasis && oasis.nature_troops?.length > 0 && (
          <div style={{ position: 'absolute', top: 2, left: 2, fontSize: 7, background: 'rgba(139,69,19,0.85)', color: '#fff', borderRadius: 3, padding: '1px 3px', pointerEvents: 'none', fontWeight: 'bold' }}>
            {oasis.nature_troops.reduce((s, t) => s + t.count, 0).toLocaleString()}
          </div>
        )}

        {/* Village text */}
        {hasVillage && (
          <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', color: isMine ? '#006600' : isNatar ? '#cc0000' : '#333', textShadow: '0 0 2px #fff, 0 0 2px #fff', lineHeight: '11px', maxWidth: 58, margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {village.name}
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
    <div className="map" style={{ direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '10px auto' }}>
        <div style={{ position: 'relative' }}>
          {/* Y-axis ruler */}
          <div style={{ position: 'absolute', right: -30, top: 0, width: 28 }}>
            {yCoords.map((yc) => (
              <div key={yc} style={{ height: TILE_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: '#333' }}>{yc}</div>
            ))}
          </div>

          {/* Map container */}
          <div ref={mapRef} style={{ position: 'relative', width: COLS * TILE_SIZE, height: ROWS * TILE_SIZE, border: '2px solid #636363', background: '#C3EDAE', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 100, textAlign: 'center', fontWeight: 'bold', fontSize: 14 }}>در حال بارگذاری نقشه...</div>
            ) : (
              <div style={{ width: '100%', height: '100%' }}>
                {grid.map((cell) => renderTile(cell))}
              </div>
            )}
          </div>

          {/* X-axis ruler */}
          <div style={{ width: COLS * TILE_SIZE, display: 'flex' }}>
            {xCoords.map((xc) => (
              <div key={xc} style={{ width: TILE_SIZE, textAlign: 'center', fontSize: 10, fontWeight: 'bold', color: '#333', paddingTop: 2 }}>{xc}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <div style={{ textAlign: 'center', margin: '8px 0' }}>
        <button onClick={() => setCenter((c) => ({ ...c, y: c.y + 1 }))} style={{ background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontWeight: 'bold', margin: '2px' }}>▲</button>
        <div style={{ display: 'inline-flex', gap: 4 }}>
          <button onClick={() => setCenter((c) => ({ ...c, x: c.x - 1 }))} style={{ background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontWeight: 'bold', margin: '2px' }}>◄</button>
          <button onClick={() => setCenter((c) => ({ ...c, x: c.x + 1 }))} style={{ background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontWeight: 'bold', margin: '2px' }}>►</button>
        </div>
        <button onClick={() => setCenter((c) => ({ ...c, y: c.y - 1 }))} style={{ background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', fontWeight: 'bold', margin: '2px' }}>▼</button>
      </div>

      {/* Coordinate input */}
      <form onSubmit={handleCoordSubmit} style={{ textAlign: 'center', margin: '8px 0' }}>
        <span style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>X:</span>
        <input type="text" value={coordInput.x} onChange={(e) => setCoordInput((p) => ({ ...p, x: e.target.value }))} style={{ width: 50, textAlign: 'center', border: '1px solid #999', borderRadius: 3, padding: '2px 4px', fontSize: 12, direction: 'ltr', margin: '0 4px' }} />
        <span style={{ fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>Y:</span>
        <input type="text" value={coordInput.y} onChange={(e) => setCoordInput((p) => ({ ...p, y: e.target.value }))} style={{ width: 50, textAlign: 'center', border: '1px solid #999', borderRadius: 3, padding: '2px 4px', fontSize: 12, direction: 'ltr', margin: '0 4px' }} />
        <button type="submit" style={{ background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 4, padding: '3px 12px', cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>OK</button>
      </form>

      {/* Legend */}
      <div style={{ textAlign: 'center', margin: '8px 0', fontSize: 10, color: '#252525', lineHeight: '18px' }}>
        <span style={{ margin: '0 6px' }}>● <span style={{ color: '#006600' }}>دهکده من</span></span>
        <span style={{ margin: '0 6px' }}>● <span style={{ color: '#8b7355' }}>بازیکن دیگر</span></span>
        <span style={{ margin: '0 6px' }}>● <span style={{ color: '#cc3333' }}>ناتار</span></span>
        <span style={{ margin: '0 6px' }}>● <span style={{ color: '#9966cc' }}>شگفتی جهان</span></span>
        <span style={{ margin: '0 6px' }}>● <span style={{ color: '#5a8a3a' }}>آبادی آزاد</span></span>
        <span style={{ margin: '0 6px' }}>● <span style={{ color: '#3a6a2a' }}>آبادی اشغال‌شده</span></span>
      </div>

      {/* Hover tooltip */}
      {hoveredTile && (
        <div style={{
          position: 'fixed', left: tooltipPos.x + 15, top: tooltipPos.y - 10,
          background: 'rgba(0,0,0,0.88)', color: '#FFF', padding: '8px 12px',
          borderRadius: 6, fontSize: 11, zIndex: 200, pointerEvents: 'none',
          minWidth: 160, lineHeight: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          direction: 'rtl', fontFamily: 'Tahoma,Arial,sans-serif',
        }}>
          {hoveredTile.village ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.3)', paddingBottom: 4 }}>
                {hoveredTile.village.name}
              </div>
              <div>({hoveredTile.y}|{hoveredTile.x})</div>
              <div>بازیکن: {hoveredTile.village.owner}</div>
              {hoveredTile.village.tribe && <div>قبیله: {hoveredTile.village.tribe}</div>}
              {hoveredTile.village.alliance_id && <div>اتحاد: #{hoveredTile.village.alliance_id}</div>}
              <div>جمعیت: {hoveredTile.village.population?.toLocaleString()}</div>
              {hoveredTile.village.wall_level > 0 && <div>دیوار: سطح {hoveredTile.village.wall_level}</div>}
              {hoveredTile.village.is_capital && <div style={{ color: '#f88c1f' }}>پایتخت</div>}
            </>
          ) : hoveredTile.oasis ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>آبادی</div>
              <div>({hoveredTile.y}|{hoveredTile.x})</div>
              {/* Multi-bonus display */}
              <div style={{ margin: '3px 0' }}>
                {hoveredTile.oasis.bonuses?.map((b, i) => (
                  <span key={i} style={{ fontSize: 10, marginRight: 4 }}>{OASIS_BONUS_LABELS[b[0]] || b[0]} {b[1]}%</span>
                )) || <span>{OASIS_BONUS_LABELS[hoveredTile.oasis.bonus_resource]} {hoveredTile.oasis.bonus_percent}%</span>}
              </div>
              <div>دفاع: {hoveredTile.oasis.defense_strength}</div>
              {/* Nature troops */}
              {hoveredTile.oasis.nature_troops?.length > 0 && (
                <div style={{ marginTop: 3, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 3 }}>
                  {hoveredTile.oasis.nature_troops.map((t, i) => (
                    <span key={i} style={{ fontSize: 10, marginRight: 4 }}>{t.name}: {t.count}</span>
                  ))}
                </div>
              )}
              <div>{hoveredTile.oasis.is_free ? 'آزاد' : `مالک: ${hoveredTile.oasis.owner_name}`}</div>
              {/* Distance */}
              {hoveredTile.distance != null && (
                <div style={{ color: hoveredTile.distance > OASIS_CAPTURE_MAX_DISTANCE ? '#ff6666' : '#66ff66', marginTop: 2 }}>
                  فاصله: {hoveredTile.distance.toFixed(1)} {hoveredTile.distance > OASIS_CAPTURE_MAX_DISTANCE ? '(خارج از محدوده)' : ''}
                </div>
              )}
            </>
          ) : (
            <div>({hoveredTile.y}|{hoveredTile.x})</div>
          )}
        </div>
      )}

      {/* Position details popup */}
      {selectedTile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFF', border: '2px solid #C9C9C9', borderRadius: 8, maxWidth: 420, width: '100%', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#f8f8f8', padding: '10px 14px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '6px 6px 0 0' }}>
              <span style={{ fontWeight: 'bold', fontSize: 14 }}>جزئیات موقعیت</span>
              <button onClick={() => { setSelectedTile(null); setPositionDetail(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>&#10006;</button>
            </div>
            <div style={{ padding: 14 }}>
              {detailLoading ? (
                <p style={{ textAlign: 'center', color: '#666' }}>در حال بارگذاری...</p>
              ) : positionDetail ? (
                <div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>({selectedTile.y}|{selectedTile.x})</div>
                  {positionDetail.type === 'village' && (
                    <>
                      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>{positionDetail.name}</h3>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr><td style={{ padding: '4px 0', color: '#666' }}>بازیکن</td><td style={{ fontWeight: 'bold' }}>{positionDetail.owner}</td></tr>
                          {positionDetail.tribe && <tr><td style={{ padding: '4px 0', color: '#666' }}>قبیله</td><td>{positionDetail.tribe}</td></tr>}
                          {positionDetail.alliance_id && <tr><td style={{ padding: '4px 0', color: '#666' }}>اتحاد</td><td>#{positionDetail.alliance_id}</td></tr>}
                          <tr><td style={{ padding: '4px 0', color: '#666' }}>جمعیت</td><td style={{ fontWeight: 'bold' }}>{positionDetail.population?.toLocaleString()}</td></tr>
                          {positionDetail.wall_level > 0 && <tr><td style={{ padding: '4px 0', color: '#666' }}>دیوار</td><td>سطح {positionDetail.wall_level}</td></tr>}
                          {positionDetail.field_distribution && (
                            <tr><td style={{ padding: '4px 0', color: '#666' }}>توزیع منابع</td><td style={{ fontWeight: 'bold', color: '#498843' }}>{positionDetail.field_distribution}</td></tr>
                          )}
                          {positionDetail.is_capital && <tr><td style={{ padding: '4px 0', color: '#f88c1f', fontWeight: 'bold' }} colSpan={2}>پایتخت</td></tr>}
                        </tbody>
                      </table>
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button onClick={() => { setSelectedTile(null); setPositionDetail(null); navigate('/send-troops', { state: { targetVillageId: positionDetail.id, targetName: positionDetail.name } }); }} style={{ flex: 1, padding: 8, background: '#498843', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}>ارسال نیرو</button>
                        <button onClick={() => { setSelectedTile(null); setPositionDetail(null); navigate('/marketplace', { state: { targetX: selectedTile.x, targetY: selectedTile.y } }); }} style={{ flex: 1, padding: 8, background: '#F88C1F', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: 'pointer', fontSize: 12 }}>ارسال منابع</button>
                      </div>
                    </>
                  )}
                  {positionDetail.type === 'oasis' && (
                    <>
                      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>آبادی</h3>
                      {/* Bonus badges */}
                      <div style={{ marginBottom: 8 }}>
                        {positionDetail.bonuses?.map((b, i) => (
                          <BonusBadge key={i} resource={b[0]} percent={b[1]} />
                        )) || <BonusBadge resource={positionDetail.bonus_resource} percent={positionDetail.bonus_percent} />}
                      </div>
                      <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                        <tbody>
                          <tr><td style={{ padding: '4px 0', color: '#666' }}>قدرت دفاعی</td><td>{positionDetail.defense_strength}</td></tr>
                          <tr><td style={{ padding: '4px 0', color: '#666' }}>وضعیت</td><td>{positionDetail.is_free ? 'آزاد' : `مالک: ${positionDetail.owner_name}`}</td></tr>
                          {positionDetail.distance != null && (
                            <tr><td style={{ padding: '4px 0', color: '#666' }}>فاصله</td><td style={{ color: positionDetail.distance > OASIS_CAPTURE_MAX_DISTANCE ? '#DE0000' : '#228B22', fontWeight: 'bold' }}>
                              {positionDetail.distance.toFixed(1)} خانه {positionDetail.distance > OASIS_CAPTURE_MAX_DISTANCE && '(خارج از محدوده)'}
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                      {/* Nature troops */}
                      {positionDetail.nature_troops?.length > 0 && (
                        <div style={{ marginTop: 8, padding: 8, background: '#fff8f0', borderRadius: 4, border: '1px solid #f0d0a0' }}>
                          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#8B4513', marginBottom: 4 }}>نیروهای مدافع طبیعت:</div>
                          {positionDetail.nature_troops.map((t, i) => (
                            <div key={i} style={{ fontSize: 10, color: '#5a3a1a', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{t.name}: {t.count}</span>
                              <span>⚔️{t.attack} 🛡️{t.defense_infantry}/{t.defense_cavalry}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {positionDetail.type === 'empty' && (
                    <p style={{ textAlign: 'center', color: '#666' }}>این موقعیت خالی است.</p>
                  )}
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#666' }}>اطلاعاتی یافت نشد.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Oasis attack modal */}
      {selectedOasis && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFF', border: '2px solid #C9C9C9', borderRadius: 8, maxWidth: 400, width: '100%', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
            <div style={{ background: '#498843', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '6px 6px 0 0' }}>
              <span style={{ fontWeight: 'bold', fontSize: 14, color: '#fff' }}>آبادی ({selectedOasis.x_coord}|{selectedOasis.y_coord})</span>
              <button onClick={() => { setSelectedOasis(null); setOasisAlert(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff' }}>&#10006;</button>
            </div>
            <div style={{ padding: 14 }}>
              {/* Bonus display */}
              <div style={{ marginBottom: 8 }}>
                {selectedOasis.bonuses?.map((b, i) => (
                  <BonusBadge key={i} resource={b[0]} percent={b[1]} />
                )) || <BonusBadge resource={selectedOasis.bonus_resource} percent={selectedOasis.bonus_percent} />}
              </div>
              <p style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>
                قدرت دفاعی: {selectedOasis.defense_strength}
              </p>
              {/* Nature troops defense info */}
              {selectedOasis.nature_troops?.length > 0 && (
                <div style={{ padding: 8, background: '#fff8f0', borderRadius: 4, border: '1px solid #f0d0a0', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: '#8B4513', marginBottom: 4 }}>نیروهای مدافع:</div>
                  {selectedOasis.nature_troops.map((t, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#5a3a1a' }}>
                      {t.name}: {t.count}
                    </div>
                  ))}
                </div>
              )}
              {oasisAlert && <p style={{ fontSize: 11, fontWeight: 'bold', color: '#228B22', marginBottom: 8 }}>{oasisAlert}</p>}
              <div style={{ maxHeight: 200, overflow: 'auto', marginBottom: 8 }}>
                {availableTroops.map((t) => (
                  <div key={t.troop_type_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '4px 0', borderBottom: '1px solid #EEE' }}>
                    <span>{t.name} (موجود: {t.count})</span>
                    <input type="number" min="0" max={t.count} style={{ width: 60, textAlign: 'center', border: '1px solid #ccc', borderRadius: 3, padding: '2px 4px' }}
                      value={oasisTroops[t.troop_type_id] || ''}
                      onChange={(e) => setOasisTroops((p) => ({ ...p, [t.troop_type_id]: Math.max(0, Math.min(t.count, parseInt(e.target.value) || 0)) }))} />
                  </div>
                ))}
              </div>
              <button onClick={handleOasisAttack} disabled={attackingOasis} style={{ width: '100%', padding: 10, background: attackingOasis ? '#ccc' : '#DE0000', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 'bold', cursor: attackingOasis ? 'not-allowed' : 'pointer', marginBottom: 8 }}>
                {attackingOasis ? '...' : 'حمله به آبادی (فوری)'}
              </button>
              <button onClick={() => { setSelectedOasis(null); setOasisAlert(null); }} style={{ width: '100%', padding: 8, background: '#eee', color: '#333', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>بستن</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
