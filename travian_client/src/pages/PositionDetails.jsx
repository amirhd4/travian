import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { MAP, RESOURCES } from '../constants/images';

const FIELD_DISTRIBUTIONS = {
  1: { wood: 3, clay: 3, iron: 3, crop: 9, label: '3-3-3-9' },
  2: { wood: 3, clay: 4, iron: 5, crop: 6, label: '3-4-5-6' },
  3: { wood: 4, clay: 4, iron: 4, crop: 6, label: '4-4-4-6' },
  4: { wood: 4, clay: 5, iron: 3, crop: 6, label: '4-5-3-6' },
  5: { wood: 5, clay: 3, iron: 4, crop: 6, label: '5-3-4-6' },
  6: { wood: 1, clay: 1, iron: 1, crop: 15, label: '1-1-1-15' },
  7: { wood: 4, clay: 4, iron: 3, crop: 7, label: '4-4-3-7' },
  8: { wood: 3, clay: 4, iron: 4, crop: 7, label: '3-4-4-7' },
  9: { wood: 4, clay: 3, iron: 4, crop: 7, label: '4-3-4-7' },
  10: { wood: 3, clay: 5, iron: 4, crop: 6, label: '3-5-4-6' },
  11: { wood: 4, clay: 3, iron: 5, crop: 6, label: '4-3-5-6' },
  12: { wood: 5, clay: 4, iron: 3, crop: 6, label: '5-4-3-6' },
};

const OASIS_BONUS_LABELS = {
  wood: 'چوب', clay: 'خشت', iron: 'آهن', crop: 'گندم',
};

const TRIBE_NAMES = { ROMAN: 'روم', TEUTON: 'توتن', GAUL: 'گل', NATAR: 'ناتار' };

const MOVEMENT_TYPE_LABELS = {
  ATTACK: 'حمله', RAID: 'غارت', REINFORCEMENT: 'نیروی کمکی', SCOUT: 'جاسوسی', RETURN: 'بازگشت',
};

function ResourceDistributionTable({ fieldType, oasisType, isOasis }) {
  if (isOasis && oasisType) {
    // Oasis bonus display
    const OASIS_TYPE_BONUSES = {
      1: [('wood', 25)], 2: [('wood', 50)], 3: [('wood', 25), ('crop', 25)],
      4: [('clay', 25)], 5: [('clay', 50)], 6: [('clay', 25), ('crop', 25)],
      7: [('iron', 25)], 8: [('iron', 50)], 9: [('iron', 25), ('crop', 25)],
      10: [('crop', 25)], 11: [('crop', 25)], 12: [('crop', 50)],
    };
    const bonuses = OASIS_TYPE_BONUSES[oasisType] || [];
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6, color: '#252525' }}>منابع آبادی:</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {bonuses.map(([res, pct], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#E5EECC', border: '1px solid #99C01A', borderRadius: 3, fontSize: 12, fontWeight: 'bold' }}>
              <img src={RESOURCES[res]} style={{ width: 18, height: 16 }} alt="" />
              <span>{OASIS_BONUS_LABELS[res]}</span>
              <span style={{ color: '#228B22' }}>+{pct}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!fieldType || !FIELD_DISTRIBUTIONS[fieldType]) return null;
  const dist = FIELD_DISTRIBUTIONS[fieldType];

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6, color: '#252525' }}>توزیع منابع: <span style={{ direction: 'ltr', display: 'inline-block' }}>{dist.label}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {['wood', 'clay', 'iron', 'crop'].map((res) => (
          <div key={res} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px', background: '#F5F5F5', border: '1px solid #C9C9C9', borderRadius: 3, fontSize: 12 }}>
            <img src={RESOURCES[res]} style={{ width: 18, height: 16 }} alt="" />
            <span style={{ fontWeight: 'bold' }}>{dist[res]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportItem({ report }) {
  const typeIcons = {
    ATTACK: '⚔️', RAID: '🗡️', REINFORCEMENT: '🛡️', SCOUT: '👁️', RETURN: '↩️',
  };
  const isAttackerWin = report.victory === 'attacker';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: 12 }}>
      <span style={{ fontSize: 16 }}>{typeIcons[report.type] || '⚔️'}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold' }}>
          {MOVEMENT_TYPE_LABELS[report.type] || report.type}
        </div>
        <div style={{ fontSize: 11, color: '#666' }}>
          {report.attacker} ({report.attacker_coords}) vs {report.defender} ({report.defender_coords})
        </div>
      </div>
      <span style={{ fontSize: 11, color: isAttackerWin ? '#DE0000' : '#228B22', fontWeight: 'bold' }}>
        {isAttackerWin ? 'پیروزی مهاجم' : 'پیروزی مدافع'}
      </span>
      <span style={{ fontSize: 10, color: '#888' }}>
        {new Date(report.date).toLocaleDateString('fa-IR')}
      </span>
    </div>
  );
}

export default function PositionDetails() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const villages = useGameStore((s) => s.villages);

  const x = parseInt(searchParams.get('x') || '0', 10);
  const y = parseInt(searchParams.get('y') || '0', 10);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!x && !y) return;
    setLoading(true);
    setError(null);
    api.get('game/position-details/', { params: { x, y } })
      .then(({ data }) => setData(data))
      .catch((e) => setError(e.response?.data?.error || 'خطا در دریافت اطلاعات'))
      .finally(() => setLoading(false));
  }, [x, y]);

  const handleCenterMap = () => {
    navigate(`/world-map?x=${x}&y=${y}`);
  };

  const handleSendTroops = () => {
    if (!data || data.type !== 'village') return;
    navigate('/send-troops', { state: { targetVillageId: data.id, targetName: data.name } });
  };

  const handleSendMerchants = () => {
    if (!data || data.type !== 'village') return;
    navigate('/marketplace', { state: { targetX: x, targetY: y } });
  };

  const handleFoundVillage = () => {
    navigate('/colonize', { state: { targetX: x, targetY: y } });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
        <div style={{ marginBottom: 8 }}>در حال بارگذاری...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ color: '#DE0000', fontWeight: 'bold', marginBottom: 12 }}>{error}</div>
        <button onClick={handleCenterMap} className="btn-primary">بازگشت به نقشه</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
        اطلاعاتی یافت نشد
      </div>
    );
  }

  return (
    <div style={{ direction: 'rtl', fontFamily: 'Tahoma, Arial, sans-serif', maxWidth: 600, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: '#498843', color: '#fff', padding: '8px 12px', fontWeight: 'bold', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '2px 2px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data.type === 'village' && data.is_capital && <span>⭐</span>}
          <span>{data.name || (data.type === 'oasis' ? 'آبادی' : data.type === 'empty' ? 'دره متروکه' : 'موقعیت')}</span>
          <span style={{ fontSize: 12, opacity: 0.9 }}>({y}|{x})</span>
        </div>
      </div>

      {/* Tile visual */}
      <div style={{ background: '#C3EDAE', padding: 12, borderBottom: '1px solid #C9C9C9', textAlign: 'center' }}>
        {data.type === 'village' && data.field_type > 0 && (
          <img src={MAP.getTerrain(data.field_type)} style={{ width: 120, height: 120 }} alt="" />
        )}
        {data.type === 'oasis' && data.oasis_type > 0 && (
          <img src={data.is_free ? MAP.getOasisTile(data.oasis_type) : MAP.getOasisOccupied(data.oasis_type)} style={{ width: 120, height: 120 }} alt="" />
        )}
        {data.type === 'empty' && data.field_type > 0 && (
          <img src={MAP.getTerrain(data.field_type)} style={{ width: 120, height: 120 }} alt="" />
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '8px 12px', background: '#E5EECC', borderBottom: '1px solid #C9C9C9', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={handleCenterMap} className="btn-primary">📍 مرکز نقشه</button>

        {data.type === 'village' && !data.is_mine && (
          <>
            <button onClick={handleSendTroops} className="btn-danger">⚔️ ارسال نیرو</button>
            <button onClick={handleSendMerchants} className="btn-gold">📦 ارسال منابع</button>
          </>
        )}

        {data.type === 'oasis' && data.is_free && (
          <button onClick={handleSendTroops} className="btn-danger">⚔️ تصاحب آبادی</button>
        )}

        {data.type === 'oasis' && !data.is_free && !data.is_mine && (
          <button onClick={handleSendTroops} className="btn-danger">⚔️ غارت آبادی</button>
        )}

        {data.type === 'oasis' && data.is_mine && (
          <span style={{ fontSize: 12, fontWeight: 'bold', color: '#228B22' }}>✓ این آبادی متعلق به شماست</span>
        )}

        {data.type === 'empty' && (
          <button onClick={handleFoundVillage} className="btn-gold">🏠 تاسیس دهکده</button>
        )}
      </div>

      {/* Content */}
      <div style={{ background: '#fff', padding: 12 }}>

        {/* Village info */}
        {data.type === 'village' && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', width: 100 }}>بازیکن</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{data.owner}</td>
                </tr>
                {data.tribe && (
                  <tr>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>قبیله</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{TRIBE_NAMES[data.tribe] || data.tribe}</td>
                  </tr>
                )}
                {data.alliance_name && (
                  <tr>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>اتحاد</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{data.alliance_name}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>جمعیت</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{data.population?.toLocaleString()}</td>
                </tr>
                {data.wall_level > 0 && (
                  <tr>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>دیوار</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>سطح {data.wall_level}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {data.is_capital && (
              <div style={{ padding: '6px 10px', background: '#fdf3e8', border: '1px solid #F88C1F', borderRadius: 3, marginBottom: 12, fontSize: 12, fontWeight: 'bold', color: '#b3721f', textAlign: 'center' }}>
                ⭐ این دهکده پایتخت است
              </div>
            )}

            {data.is_mine && (
              <div style={{ padding: '6px 10px', background: '#e8f5e9', border: '1px solid #c8e6c9', borderRadius: 3, marginBottom: 12, fontSize: 12, fontWeight: 'bold', color: '#27ae60', textAlign: 'center' }}>
                ✓ این دهکده متعلق به شماست
              </div>
            )}

            <ResourceDistributionTable fieldType={data.field_type} />
          </div>
        )}

        {/* Oasis info */}
        {data.type === 'oasis' && (
          <div>
            {/* Bonuses */}
            <div style={{ marginBottom: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {data.bonuses?.map(([res, pct], i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#E5EECC', border: '1px solid #99C01A', borderRadius: 3, fontSize: 12, fontWeight: 'bold' }}>
                  <img src={RESOURCES[res]} style={{ width: 18, height: 16 }} alt="" />
                  <span>{OASIS_BONUS_LABELS[res]}</span>
                  <span style={{ color: '#228B22' }}>+{pct}%</span>
                </div>
              ))}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', width: 100 }}>قدرت دفاعی</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{data.defense_strength}</td>
                </tr>
                <tr>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>وضعیت</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                    {data.is_free ? <span style={{ color: '#228B22' }}>آزاد</span> : `مالک: ${data.owner_player}`}
                  </td>
                </tr>
                {data.owner_name && (
                  <tr>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>دهکده مالک</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{data.owner_name}</td>
                  </tr>
                )}
                {data.owner_tribe && (
                  <tr>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>قبیله</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{TRIBE_NAMES[data.owner_tribe] || data.owner_tribe}</td>
                  </tr>
                )}
                {data.owner_alliance_name && (
                  <tr>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666' }}>اتحاد</td>
                    <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{data.owner_alliance_name}</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Nature troops */}
            {data.nature_troops?.length > 0 && (
              <div style={{ marginTop: 12, padding: 10, background: '#fdfbf7', border: '1px solid #f0e6d2', borderRadius: 3 }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: '#8B4513', marginBottom: 8, borderBottom: '1px solid #f0e6d2', paddingBottom: 4 }}>نیروهای مدافع طبیعت:</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'right', background: '#f5f0e5' }}>نیرو</th>
                      <th style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center', background: '#f5f0e5' }}>تعداد</th>
                      <th style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center', background: '#f5f0e5' }}>حمله</th>
                      <th style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center', background: '#f5f0e5' }}>دفاع پیاده</th>
                      <th style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center', background: '#f5f0e5' }}>دفاع سواره</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.nature_troops.map((t, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2' }}>{t.name}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center', fontWeight: 'bold', color: '#d35400' }}>{t.count}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center' }}>{t.attack}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center' }}>{t.defense_infantry}</td>
                        <td style={{ padding: '4px 6px', borderBottom: '1px solid #f0e6d2', textAlign: 'center' }}>{t.defense_cavalry}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Empty slot info */}
        {data.type === 'empty' && (
          <div>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 12, lineHeight: '1.6' }}>
              این قسمت از نقشه هنوز توسط بازیکنی تسخیر نشده است و آماده بنای یک دهکده جدید می‌باشد.
            </p>

            <ResourceDistributionTable fieldType={data.field_type} />

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button onClick={handleFoundVillage} className="btn-gold" style={{ padding: '8px 24px', fontSize: 13 }}>
                🏠 تاسیس دهکده جدید
              </button>
              <p style={{ fontSize: 10, color: '#888', marginTop: 6 }}>* نیازمند ۳ مهاجر و امتیاز فرهنگی کافی</p>
            </div>
          </div>
        )}

        {/* Reports section */}
        {data.type === 'village' && data.reports?.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '2px solid #99C01A', paddingTop: 12 }}>
            <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8, color: '#252525' }}>آخرین گزارشات:</div>
            <div style={{ border: '1px solid #C9C9C9', borderRadius: 3 }}>
              {data.reports.map((report) => (
                <ReportItem key={report.id} report={report} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ background: '#E5EECC', padding: '8px 12px', borderTop: '1px solid #C9C9C9', borderRadius: '0 0 2px 2px', textAlign: 'center' }}>
        <button onClick={handleCenterMap} className="btn-primary">بازگشت به نقشه</button>
      </div>
    </div>
  );
}
