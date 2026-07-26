import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';

const ITEMS_PER_PAGE = 20;

export default function CropFinder() {
  const navigate = useNavigate();
  const villages = useGameStore((s) => s.villages);
  const activeVillageId = useGameStore((s) => s.activeVillageId);
  const activeVillage = villages.find((v) => v.id === activeVillageId);

  const [centerX, setCenterX] = useState('');
  const [centerY, setCenterY] = useState('');
  const [searchType, setSearchType] = useState('15');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Set default coordinates from active village
  useEffect(() => {
    if (activeVillage && !centerX && !centerY) {
      setCenterX(String(activeVillage.x_coord));
      setCenterY(String(activeVillage.y_coord));
    }
  }, [activeVillage]);

  const handleSearch = useCallback(async () => {
    const x = parseInt(centerX, 10);
    const y = parseInt(centerY, 10);
    if (isNaN(x) || isNaN(y)) {
      setError('لطفاً مختصات معتبر وارد کنید');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);
    setCurrentPage(1);

    try {
      const { data } = await api.get('game/gold/cropper-search/', {
        params: { x, y, type: searchType, radius: 50 },
      });
      setResults(data);
    } catch (e) {
      setError(e.response?.data?.error || 'خطا در جستجو');
    } finally {
      setLoading(false);
    }
  }, [centerX, centerY, searchType]);

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSearch();
  };

  // Pagination
  const totalPages = results ? Math.ceil(results.results.length / ITEMS_PER_PAGE) : 0;
  const paginatedResults = results
    ? results.results.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
    : [];

  return (
    <div style={{ direction: 'rtl', fontFamily: 'Tahoma, Arial, sans-serif', maxWidth: 700, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ background: '#498843', color: '#fff', padding: '8px 12px', fontWeight: 'bold', fontSize: 14, borderRadius: '2px 2px 0 0' }}>
        🔍 جستجوی گندمی
      </div>

      {/* Search form */}
      <div style={{ background: '#E5E5E5', border: '1px solid #C9C9C9', borderTop: 'none', padding: 12 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: 12, marginBottom: 4, color: '#252525' }}>مرکز جستجو:</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#555' }}>X:</span>
                <input
                  type="number"
                  value={centerX}
                  onChange={(e) => setCenterX(e.target.value)}
                  style={{ width: 70, textAlign: 'center', border: '1px solid #CCC', padding: '4px', fontSize: 12, direction: 'ltr' }}
                  placeholder="X"
                />
              </div>
              <span style={{ color: '#555', fontWeight: 'bold' }}>|</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#555' }}>Y:</span>
                <input
                  type="number"
                  value={centerY}
                  onChange={(e) => setCenterY(e.target.value)}
                  style={{ width: 70, textAlign: 'center', border: '1px solid #CCC', padding: '4px', fontSize: 12, direction: 'ltr' }}
                  placeholder="Y"
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: 12, marginBottom: 4, color: '#252525' }}>نوع جستجو:</label>
            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" name="type" value="15" checked={searchType === '15'} onChange={(e) => setSearchType(e.target.value)} />
                ۱۵ گندمی
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" name="type" value="9" checked={searchType === '9'} onChange={(e) => setSearchType(e.target.value)} />
                ۹ گندمی
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'در حال جستجو...' : 'جستجو'}
            </button>
            <button type="button" onClick={() => navigate('/world-map')} className="btn-ghost">
              بازگشت به نقشه
            </button>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: 10, background: '#fdedec', border: '1px solid #fadbd8', color: '#c0392b', fontSize: 12, fontWeight: 'bold', marginTop: 8 }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div style={{ marginTop: 8 }}>
          <div style={{ padding: '6px 10px', background: '#E5EECC', border: '1px solid #C9C9C9', fontSize: 12, fontWeight: 'bold', color: '#252525' }}>
            نتایج: {results.total_found} مورد یافت شد ({results.type})
          </div>

          {results.results.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#666', fontSize: 12, background: '#fff', border: '1px solid #C9C9C9', borderTop: 'none' }}>
              نتیجه‌ای یافت نشد
            </div>
          ) : (
            <>
              <div style={{ background: '#fff', border: '1px solid #C9C9C9', borderTop: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'right', fontWeight: 'bold' }}>فاصله</th>
                      <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'right', fontWeight: 'bold' }}>موقعیت</th>
                      <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'right', fontWeight: 'bold' }}>نوع</th>
                      <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'right', fontWeight: 'bold' }}>بонوس آبادی</th>
                      <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'right', fontWeight: 'bold' }}>مالک</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>{r.distance.toFixed(1)}</td>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                          <a
                            onClick={() => navigate(`/world-map?x=${r.x_coord}&y=${r.y_coord}`)}
                            style={{ color: '#99C01A', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            ({r.x_coord}|{r.y_coord})
                          </a>
                        </td>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#228B22' }}>
                          {results.type === '15-cropper' ? '۱۵ گندمی' : '۹ گندمی'}
                        </td>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                          {r.oasis_bonus ? `+${r.oasis_bonus}%` : '-'}
                        </td>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                          {r.player_name || <span style={{ color: '#888' }}>----</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 0', background: '#E5EECC', border: '1px solid #C9C9C9', borderTop: 'none', borderRadius: '0 0 2px 2px' }}>
                  {currentPage > 1 && (
                    <button onClick={() => setCurrentPage(1)} className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}>اول</button>
                  )}
                  {currentPage > 1 && (
                    <button onClick={() => setCurrentPage(currentPage - 1)} className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}>قبلی</button>
                  )}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          padding: '2px 8px', fontSize: 11, fontWeight: page === currentPage ? 'bold' : 'normal',
                          background: page === currentPage ? '#498843' : '#E5E5E5',
                          color: page === currentPage ? '#fff' : '#252525',
                          border: '1px solid #C9C9C9', borderRadius: 2, cursor: 'pointer',
                        }}
                      >
                        {page}
                      </button>
                    );
                  })}
                  {currentPage < totalPages && (
                    <button onClick={() => setCurrentPage(currentPage + 1)} className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}>بعدی</button>
                  )}
                  {currentPage < totalPages && (
                    <button onClick={() => setCurrentPage(totalPages)} className="btn-ghost" style={{ padding: '2px 8px', fontSize: 11 }}>آخر</button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
