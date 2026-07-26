import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { MAP, RESOURCES } from '../constants/images';

const NORMAL_RADIUS = 4;
const FULLSCREEN_RADIUS = 10;
const NORMAL_COLS = 9;
const NORMAL_ROWS = 7;
const FULLSCREEN_COLS = 22;
const FULLSCREEN_ROWS = 11;
const TILE_SIZE = 60;
const OASIS_CAPTURE_MAX_DISTANCE = 10;

const FIELD_DISTRIBUTIONS = {
  1: '3-3-3-9', 2: '3-4-5-6', 3: '4-4-4-6', 4: '4-5-3-6',
  5: '5-3-4-6', 6: '1-1-1-15', 7: '4-4-3-7', 8: '3-4-4-7',
  9: '4-3-4-7', 10: '3-5-4-6', 11: '4-3-5-6', 12: '5-4-3-6',
};

const OASIS_BONUS_LABELS = {
  wood: 'چوب', clay: 'خشت', iron: 'آهن', crop: 'گندم',
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
  const icons = { wood: RESOURCES.wood, clay: RESOURCES.clay, iron: RESOURCES.iron, crop: RESOURCES.crop };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', margin: '2px', borderRadius: 4, fontSize: 11, fontWeight: 'bold', background: colors[resource] || '#888', color: '#fff' }}>
      {icons[resource] && <img src={icons[resource]} style={{ width: 14, height: 12 }} alt="" />}
      {OASIS_BONUS_LABELS[resource] || resource} {percent}%
    </span>
  );
}

export default function WorldMap() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const villages = useGameStore((s) => s.villages);
  const activeVillageId = useGameStore((state) => state.activeVillageId);
  const activeVillage = villages.find((v) => v.id === activeVillageId);
  const user = useGameStore((s) => s.user);

  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [mapVillages, setMapVillages] = useState([]);
  const [oases, setOases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredTile, setHoveredTile] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [coordInput, setCoordInput] = useState({ x: '', y: '' });
  const [centerReady, setCenterReady] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedOasis, setSelectedOasis] = useState(null);
  const [oasisTroops, setOasisTroops] = useState({});
  const [availableTroops, setAvailableTroops] = useState([]);
  const [attackingOasis, setAttackingOasis] = useState(false);
  const [oasisAlert, setOasisAlert] = useState(null);
  const mapRef = useRef(null);

  const COLS = fullScreen ? FULLSCREEN_COLS : NORMAL_COLS;
  const ROWS = fullScreen ? FULLSCREEN_ROWS : NORMAL_ROWS;
  const RADIUS = fullScreen ? FULLSCREEN_RADIUS : NORMAL_RADIUS;

  // Initialize center from URL params or active village
  useEffect(() => {
    const urlX = searchParams.get('x');
    const urlY = searchParams.get('y');
    if (urlX && urlY) {
      const x = parseInt(urlX, 10);
      const y = parseInt(urlY, 10);
      if (!isNaN(x) && !isNaN(y)) {
        setCenter({ x, y });
        setCoordInput({ x: String(x), y: String(y) });
        setCenterReady(true);
        return;
      }
    }
    if (activeVillage) {
      setCenter({ x: activeVillage.x_coord, y: activeVillage.y_coord });
      setCoordInput({ x: String(activeVillage.x_coord), y: String(activeVillage.y_coord) });
      setCenterReady(true);
    }
  }, [searchParams, villages, activeVillageId, activeVillage]);

  useEffect(() => {
    if (!activeVillageId) return;
    api.get('combat/village-troops/', { params: { village_id: activeVillageId } })
      .then(({ data }) => setAvailableTroops(data)).catch(() => {});
  }, [activeVillageId]);

  useEffect(() => {
      if (fullScreen) {
        document.body.classList.add('map-fullscreen');
      } else {
        document.body.classList.remove('map-fullscreen');
      }
    }, [fullScreen]);

  const fetchMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vRes, oRes] = await Promise.all([
        api.get('game/world-map/', { params: { x: center.x, y: center.y, radius: RADIUS } }),
        api.get('game/oases/', { params: { x: center.x, y: center.y, radius: RADIUS } }),
      ]);
      setMapVillages(vRes.data);
      setOases(oRes.data);
    } catch (e) {
      console.error('Map fetch error', e);
      setError('خطا در بارگذاری نقشه');
    } finally {
      setLoading(false);
    }
  }, [center, RADIUS]);

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
    if (!cell.village) return '';
    if (cell.isMine) return 'borderown';
    if (cell.isNatar) return 'borderatwar';
    return 'borderneutr';
  };

  const handleTileClick = (cell) => {
    navigate(`/position-details?x=${cell.x}&y=${cell.y}`);
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
      setCoordInput({ x: String(nx), y: String(ny) });
      // Update URL without re-render
      const params = new URLSearchParams(searchParams);
      params.set('x', nx);
      params.set('y', ny);
      window.history.replaceState({}, '', `?${params.toString()}`);
    }
  };

  const handleVillageSelect = (e) => {
    const v = villages.find((v) => v.id === Number(e.target.value));
    if (v) {
      setCenter({ x: v.x_coord, y: v.y_coord });
      setCoordInput({ x: String(v.x_coord), y: String(v.y_coord) });
      const params = new URLSearchParams(searchParams);
      params.set('x', v.x_coord);
      params.set('y', v.y_coord);
      window.history.replaceState({}, '', `?${params.toString()}`);
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
        }}
      >
        {/* Layer 1: Tile background pattern for Natar area */}
        {isGrayTile && !isNatarCenter && tileBgPattern && (
          <img src={MAP.getTileBg(tileBgPattern)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 2: Terrain type image for empty village slots */}
        {isEmptySlot && !isGrayTile && fieldType > 0 && (
          <img src={MAP.getTerrain(fieldType)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 3: Volcano overlay for Natar center */}
        {isNatarCenter && volcanoClass && (
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', backgroundImage: `url(${MAP.volcano})`, backgroundPosition: `0 ${-(parseInt(volcanoClass.replace('volcano', '')) - 1) * 60}px`, backgroundRepeat: 'no-repeat' }} />
        )}

        {/* Layer 4: Oasis tile */}
        {hasOasis && cell.oasisType > 0 && (
          <img src={oasis.is_free ? MAP.getOasisTile(cell.oasisType) : MAP.getOasisOccupied(cell.oasisType)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Oasis glow */}
        {hasOasis && oasis.is_free && (
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 10px rgba(0,200,0,0.4)', animation: 'oasisPulse 3s ease-in-out infinite', pointerEvents: 'none' }} />
        )}
        {hasOasis && !oasis.is_free && (
          <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 8px rgba(255,180,0,0.5)', pointerEvents: 'none' }} />
        )}

        {/* Layer 5: Border */}
        {hasVillage && borderClass && (
          <img src={MAP.getBorder(borderClass)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 6: Wall level */}
        {hasVillage && wallLevel > 0 && (
          <img src={MAP.getWall(wallLevel)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 7: Population indicator */}
        {hasVillage && pop > 0 && (
          <img src={MAP.getPop(pop)} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Layer 8: Attack indicator */}
        {hasVillage && village.has_incoming_attack && (
          <img src={MAP.att1} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} alt="" />
        )}

        {/* Nature troops count badge */}
        {hasOasis && oasis.nature_troops?.length > 0 && (
          <div style={{ position: 'absolute', top: 2, left: 2, fontSize: 7, background: 'rgba(139,69,19,0.9)', color: '#fff', borderRadius: 4, padding: '2px 4px', pointerEvents: 'none', fontWeight: 'bold' }}>
            {oasis.nature_troops.reduce((s, t) => s + t.count, 0).toLocaleString()}
          </div>
        )}

        {/* Village name label */}
        {hasVillage && (
          <div style={{ position: 'absolute', bottom: 2, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 9, fontWeight: 'bold', color: isMine ? '#004d00' : isNatar ? '#a10000' : '#222', textShadow: '1px 1px 2px #fff, -1px -1px 2px #fff, 1px -1px 2px #fff, -1px 1px 2px #fff', lineHeight: '12px', maxWidth: 58, margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {village.name}
            </div>
          </div>
        )}

        {/* Empty slot label */}
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
    <div className="map" style={{ direction: 'rtl', fontFamily: 'Tahoma, Arial, sans-serif' }}>

      {/* Map Toolbar */}
      <div className="mapToolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 'bold', color: '#555' }}>دهکده:</span>
          <select onChange={handleVillageSelect} style={{ padding: '3px 6px', fontSize: 11, border: '1px solid #C9C9C9', borderRadius: 2 }}>
            {villages.map((v) => (
              <option key={v.id} value={v.id} selected={v.id === activeVillageId}>
                {v.is_capital ? '⭐ ' : ''}{v.name} ({v.x_coord}|{v.y_coord})
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => navigate('/cropfinder')} className="mapToolbarBtn">
            <img src={MAP.cropfinder} style={{ width: 16, height: 16 }} alt="" /> جستجوی گندم
          </button>
          <button onClick={() => setFullScreen(!fullScreen)} className="mapToolbarBtn">
            {fullScreen ? '▼ نمای عادی' : '▲ تمام صفحه'}
          </button>
        </div>
      </div>

      {/* Coordinate search form */}
      <form onSubmit={handleCoordSubmit} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '6px 0', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#555' }}>موقعیت:</span>
        <input type="text" value={coordInput.x} onChange={(e) => setCoordInput((p) => ({ ...p, x: e.target.value }))} style={{ width: 50, textAlign: 'center', border: '1px solid #CCC', padding: '2px 4px', fontSize: 11, direction: 'ltr' }} placeholder="X" />
        <span style={{ color: '#555', fontWeight: 'bold' }}>|</span>
        <input type="text" value={coordInput.y} onChange={(e) => setCoordInput((p) => ({ ...p, y: e.target.value }))} style={{ width: 50, textAlign: 'center', border: '1px solid #CCC', padding: '2px 4px', fontSize: 11, direction: 'ltr' }} placeholder="Y" />
        <button type="submit" className="btn-primary" style={{ padding: '3px 12px' }}>برو</button>
      </form>

      {/* Error display */}
      {error && (
        <div style={{ textAlign: 'center', padding: 10, color: '#DE0000', fontWeight: 'bold', fontSize: 12 }}>{error}</div>
      )}

      {/* Main Map Area with Rulers */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto' }}>
        <div style={{ position: 'relative', display: 'inline-block' }}>

          {/* Y-axis ruler (Right side) */}
          <div style={{ position: 'absolute', right: -30, top: 0, width: 28, background: '#2c3e50', borderRadius: '0 4px 4px 0' }}>
            {yCoords.map((yc) => (
              <div key={yc} style={{ height: TILE_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 'bold', color: '#ecf0f1' }}>{yc}</div>
            ))}
          </div>

          {/* Map container */}
          <div ref={mapRef} className={fullScreen ? 'fullscreen' : ''} style={{ position: 'relative', zIndex: "200",  width: COLS * TILE_SIZE, height: ROWS * TILE_SIZE, border: '2px solid #2c3e50', background: '#C3EDAE', overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: 100, textAlign: 'center', fontWeight: 'bold', fontSize: 13, color: '#444' }}>در حال بارگذاری نقشه...</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${TILE_SIZE}px)`, gridTemplateRows: `repeat(${ROWS}, ${TILE_SIZE}px)`, width: '100%', height: '100%' }}>
                {grid.map((cell) => renderTile(cell))}
              </div>
            )}
          </div>

          {/* X-axis ruler (Bottom side) */}
          <div style={{ position: 'absolute', bottom: -24, left: 0, width: COLS * TILE_SIZE, display: 'flex', background: '#2c3e50', borderRadius: '0 0 4px 4px' }}>
            {xCoords.map((xc) => (
              <div key={xc} style={{ width: TILE_SIZE, textAlign: 'center', fontSize: 10, fontWeight: 'bold', color: '#ecf0f1', padding: '4px 0' }}>{xc}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div style={{ position: 'relative', width: 120, height: 120, margin: '35px auto 10px auto' }}>
        <button onClick={() => setCenter((c) => ({ ...c, y: c.y + 1 }))} style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 32, height: 32, background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 3, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▲</button>
        <button onClick={() => setCenter((c) => ({ ...c, y: c.y - 1 }))} style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 32, height: 32, background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 3, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>▼</button>
        <button onClick={() => setCenter((c) => ({ ...c, x: c.x - 1 }))} style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 3, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>◄</button>
        <button onClick={() => setCenter((c) => ({ ...c, x: c.x + 1 }))} style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, background: '#498843', color: '#fff', border: '1px solid #3a6e35', borderRadius: 3, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>►</button>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 28, height: 28, background: '#dce2e8', borderRadius: '50%', border: '1px solid #b0b8c0' }} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, margin: '10px auto', padding: '8px', background: '#E5E5E5', border: '1px solid #C9C9C9', fontSize: 11 }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#228B22', borderRadius: 2, verticalAlign: 'middle' }}></span> دهکده من</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#444', borderRadius: 2, verticalAlign: 'middle' }}></span> دهکده دیگر</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#DE0000', borderRadius: 2, verticalAlign: 'middle' }}></span> ناتار</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#9966CC', borderRadius: 2, verticalAlign: 'middle' }}></span> شگفتی جهان</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#2E8B57', borderRadius: 2, verticalAlign: 'middle' }}></span> آبادی آزاد</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#8B4513', borderRadius: 2, verticalAlign: 'middle' }}></span> آبادی اشغال‌شده</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#7a9a6a', borderRadius: 2, verticalAlign: 'middle' }}></span> خانه خالی</span>
      </div>

      {/* Hover tooltip */}
      {hoveredTile && (
        <div style={{
          position: 'fixed', left: tooltipPos.x + 15, top: tooltipPos.y - 10,
          background: 'rgba(25, 30, 36, 0.95)', color: '#FFF', padding: '10px 14px',
          borderRadius: 6, fontSize: 11, zIndex: 200, pointerEvents: 'none',
          minWidth: 160, lineHeight: '18px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          direction: 'rtl', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {hoveredTile.village ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#f1c40f' }}>{hoveredTile.village.name}</div>
              <div style={{ color: '#bdc3c7' }}>({hoveredTile.y}|{hoveredTile.x})</div>
              <div>بازیکن: <span style={{ fontWeight: 'bold' }}>{hoveredTile.village.owner}</span></div>
              {hoveredTile.village.tribe && <div>قبیله: {hoveredTile.village.tribe}</div>}
              {hoveredTile.village.alliance_name && <div>اتحاد: {hoveredTile.village.alliance_name}</div>}
              <div>جمعیت: {hoveredTile.village.population?.toLocaleString()}</div>
              {hoveredTile.village.wall_level > 0 && <div>دیوار: سطح {hoveredTile.village.wall_level}</div>}
              {hoveredTile.village.is_capital && <div style={{ color: '#e67e22', marginTop: 4, fontWeight: 'bold' }}>⭐ پایتخت</div>}
              {hoveredTile.isMine && <div style={{ color: '#2ecc71', marginTop: 2 }}>✓ دهکده شما</div>}
            </>
          ) : hoveredTile.oasis ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#2ecc71' }}>آبادی</div>
              <div style={{ color: '#bdc3c7' }}>({hoveredTile.y}|{hoveredTile.x})</div>
              <div style={{ margin: '4px 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {hoveredTile.oasis.bonuses?.map((b, i) => (
                  <span key={i} style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>{OASIS_BONUS_LABELS[b[0]] || b[0]} {b[1]}%</span>
                )) || <span style={{ fontSize: 10 }}>{OASIS_BONUS_LABELS[hoveredTile.oasis.bonus_resource]} {hoveredTile.oasis.bonus_percent}%</span>}
              </div>
              <div>دفاع: {hoveredTile.oasis.defense_strength}</div>
              {hoveredTile.oasis.nature_troops?.length > 0 && (
                <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 4 }}>
                  {hoveredTile.oasis.nature_troops.map((t, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#e0e0e0' }}>- {t.name}: {t.count}</div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 4, fontWeight: 'bold' }}>{hoveredTile.oasis.is_free ? 'آزاد' : `مالک: ${hoveredTile.oasis.owner_name}`}</div>
              {hoveredTile.distance != null && (
                <div style={{ color: hoveredTile.distance > OASIS_CAPTURE_MAX_DISTANCE ? '#e74c3c' : '#2ecc71', marginTop: 2 }}>
                  فاصله: {hoveredTile.distance.toFixed(1)} {hoveredTile.distance > OASIS_CAPTURE_MAX_DISTANCE ? '(خارج از محدوده)' : ''}
                </div>
              )}
            </>
          ) : hoveredTile.isEmptySlot ? (
            <>
              <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4, color: '#95a5a6' }}>موقعیت خالی</div>
              <div style={{ color: '#bdc3c7' }}>({hoveredTile.y}|{hoveredTile.x})</div>
              {hoveredTile.fieldType > 0 && FIELD_DISTRIBUTIONS[hoveredTile.fieldType] && (
                <div style={{ marginTop: 4, color: '#2ecc71', fontSize: 10 }}>منابع: {FIELD_DISTRIBUTIONS[hoveredTile.fieldType]}</div>
              )}
              <div style={{ marginTop: 4, color: '#7f8c8d', fontSize: 10 }}>برای جزئیات کلیک کنید</div>
            </>
          ) : (
            <div>({hoveredTile.y}|{hoveredTile.x})</div>
          )}
        </div>
      )}

      {/* Oasis attack modal */}
      {selectedOasis && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#FFF', borderRadius: 4, maxWidth: 400, width: '100%', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ background: '#DE0000', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: 13, color: '#fff' }}>حمله به آبادی ({selectedOasis.y_coord}|{selectedOasis.x_coord})</span>
              <button onClick={() => { setSelectedOasis(null); setOasisAlert(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, color: '#fff' }}>&#10006;</button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {selectedOasis.bonuses?.map((b, i) => (
                  <BonusBadge key={i} resource={b[0]} percent={b[1]} />
                )) || <BonusBadge resource={selectedOasis.bonus_resource} percent={selectedOasis.bonus_percent} />}
              </div>

              <div style={{ background: '#f5f5f5', padding: 8, borderRadius: 3, marginBottom: 10, fontSize: 12 }}>
                قدرت دفاعی: <strong>{selectedOasis.defense_strength}</strong>
              </div>

              {selectedOasis.nature_troops?.length > 0 && (
                <div style={{ padding: 10, background: '#fdfbf7', borderRadius: 3, border: '1px solid #f0e6d2', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 'bold', color: '#8B4513', marginBottom: 6 }}>نیروهای مدافع:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                    {selectedOasis.nature_troops.map((t, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#5a3a1a' }}>• {t.name}: <strong>{t.count}</strong></div>
                    ))}
                  </div>
                </div>
              )}

              {oasisAlert && <div style={{ padding: 8, borderRadius: 3, fontSize: 11, fontWeight: 'bold', background: oasisAlert.includes('شکست') ? '#fdedec' : '#eafaf1', color: oasisAlert.includes('شکست') ? '#c0392b' : '#27ae60', marginBottom: 12 }}>{oasisAlert}</div>}

              <div style={{ fontWeight: 'bold', fontSize: 12, color: '#444', marginBottom: 6 }}>انتخاب نیروها:</div>
              <div style={{ maxHeight: 200, overflowY: 'auto', marginBottom: 16, border: '1px solid #ddd', borderRadius: 3, padding: 6 }}>
                {availableTroops.map((t) => (
                  <div key={t.troop_type_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '6px', borderBottom: '1px solid #f0f0f0' }}>
                    <span>{t.name} <span style={{ color: '#888', fontSize: 10 }}>({t.count})</span></span>
                    <input type="number" min="0" max={t.count} style={{ width: 60, textAlign: 'center', border: '1px solid #CCC', borderRadius: 2, padding: '4px', fontSize: 11 }}
                      value={oasisTroops[t.troop_type_id] || ''}
                      onChange={(e) => setOasisTroops((p) => ({ ...p, [t.troop_type_id]: Math.max(0, Math.min(t.count, parseInt(e.target.value) || 0)) }))} />
                  </div>
                ))}
                {availableTroops.length === 0 && <div style={{ padding: 8, textAlign: 'center', color: '#888', fontSize: 11 }}>نیرویی موجود نیست</div>}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleOasisAttack} disabled={attackingOasis || Object.values(oasisTroops).every(v => !v)} className="btn-danger" style={{ flex: 2, padding: '6px' }}>
                  {attackingOasis ? 'در حال ارسال...' : 'حمله'}
                </button>
                <button onClick={() => { setSelectedOasis(null); setOasisAlert(null); }} className="btn-ghost" style={{ flex: 1, padding: '6px' }}>انصراف</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
