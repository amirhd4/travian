import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';
import { TRIBES, MAP, RESOURCES } from '../constants/images';

const TRIBE_NAMES = { ROMAN: 'روم', TEUTON: 'توتن', GAUL: 'گل', NATURE: 'طبیعت', NATAR: 'ناتار' };

const MEDAL_CATEGORIES = {
  1: 'بهترین مهاجم هفته', 2: 'بهترین مدافع هفته', 3: 'بیشترین صعود هفته',
  4: 'بیشترین غارت هفته', 5: 'مهاجم + مدافع', 6: '۳ هفته متوالی مهاجم',
  7: '۳ هفته متوالی مدافع', 8: '۳ هفته متوالی صعود', 9: '۳ هفته متوالی غارت',
};

function HeroImage({ playerId, size = 'profile' }) {
  const [src, setSrc] = useState(`/api/combat/hero/image/?size=${size}&uid=${playerId}`);
  const heroImageVersion = useGameStore((s) => s.heroImageVersion);

  useEffect(() => {
    setSrc(`/api/combat/hero/image/?size=${size}&uid=${playerId}&v=${heroImageVersion}`);
  }, [playerId, size, heroImageVersion]);

  return (
    <img
      src={src}
      alt="Hero"
      style={{ width: size === 'profile' ? 160 : 93, height: size === 'profile' ? 205 : 95, objectFit: 'cover' }}
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
}

function DetailsTable({ data }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 12 }}>
      <tbody>
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', width: 120, background: '#E5EECC', fontWeight: 'bold' }}>رتبه</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{data.rank || '-'}</td>
        </tr>
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>قبیله</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {TRIBES[data.tribe] && <img src={TRIBES[data.tribe].splash} style={{ width: 20, height: 20, borderRadius: 3 }} alt="" />}
              {TRIBE_NAMES[data.tribe] || data.tribe}
            </span>
          </td>
        </tr>
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>اتحاد</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
            {data.alliance_tag ? (
              <span style={{ fontWeight: 'bold', color: '#498843' }}>[{data.alliance_tag}] {data.alliance_name}</span>
            ) : (
              <span style={{ color: '#888' }}>----</span>
            )}
          </td>
        </tr>
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>تعداد دهکده‌ها</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{data.village_count}</td>
        </tr>
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>جمعیت کل</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>{data.total_population?.toLocaleString()}</td>
        </tr>
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>امتیاز مهاجم</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#DE0000' }}>{data.attacker_points?.toLocaleString()}</td>
        </tr>
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>امتیاز مدافع</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', fontWeight: 'bold', color: '#228B22' }}>{data.defender_points?.toLocaleString()}</td>
        </tr>
        {data.location && (
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>مکان</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{data.location}</td>
          </tr>
        )}
        {data.gender && (
          <tr>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>جنسیت</td>
            <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{data.gender === 'M' ? 'مرد' : data.gender === 'F' ? 'زن' : 'نامشخص'}</td>
          </tr>
        )}
        <tr>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', color: '#666', background: '#E5EECC', fontWeight: 'bold' }}>تاریخ عضویت</td>
          <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>{new Date(data.date_joined).toLocaleDateString('fa-IR')}</td>
        </tr>
      </tbody>
    </table>
  );
}

function VillageList({ villages }) {
  const navigate = useNavigate();

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8, color: '#252525', background: '#498843', color: '#fff', padding: '6px 12px' }}>
        لیست دهکده‌ها ({villages.length})
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'right', fontWeight: 'bold' }}>نام</th>
            <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'center', fontWeight: 'bold' }}>جمعیت</th>
            <th style={{ padding: '6px 8px', background: '#E5EECC', borderBottom: '2px solid #99C01A', textAlign: 'center', fontWeight: 'bold' }}>موقعیت</th>
          </tr>
        </thead>
        <tbody>
          {villages.map((v) => (
            <tr key={v.id} style={{ background: v.is_capital ? '#fdf3e8' : '#fff' }}>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <a onClick={() => navigate(`/position-details?x=${v.x_coord}&y=${v.y_coord}`)} style={{ color: '#99C01A', fontWeight: 'bold', cursor: 'pointer' }}>
                  {v.name}
                </a>
                {v.is_capital && <span style={{ fontSize: 10, color: '#b3721f', marginRight: 4 }}>(پایتخت)</span>}
              </td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'center', fontWeight: 'bold' }}>{v.population?.toLocaleString()}</td>
              <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee', textAlign: 'center', whiteSpace: 'nowrap' }}>
                <a onClick={() => navigate(`/world-map?x=${v.x_coord}&y=${v.y_coord}`)} style={{ color: '#99C01A', cursor: 'pointer', direction: 'ltr' }}>
                  ({v.x_coord}|{v.y_coord})
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MedalsSection({ medals }) {
  if (!medals || medals.length === 0) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 8, background: '#498843', color: '#fff', padding: '6px 12px' }}>
        مدال‌ها ({medals.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
        {medals.map((m) => (
          <div key={m.id} style={{ textAlign: 'center', padding: 8, background: '#f5f5f5', border: '1px solid #ddd', borderRadius: 3 }}>
            <div style={{ fontSize: 10, color: '#666' }}>{MEDAL_CATEGORIES[m.category] || `دسته ${m.category}`}</div>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#b3721f' }}>رتبه {m.rank}</div>
            <div style={{ fontSize: 10, color: '#888' }}>هفته {m.day_number}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditProfileTab({ data, onSave }) {
  const [description, setDescription] = useState(data.description || '');
  const [location, setLocation] = useState(data.location || '');
  const [gender, setGender] = useState(data.gender || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('game/profile/update/', { description, location, gender });
      setMessage({ type: 'success', text: 'پروفایل با موفقیت ذخیره شد.' });
      onSave?.();
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'خطا در ذخیره' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontWeight: 'bold', fontSize: 12, marginBottom: 4, color: '#252525' }}>مکان:</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={100}
          className="field"
          style={{ width: '100%' }}
          placeholder="مکان خود را وارد کنید..."
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontWeight: 'bold', fontSize: 12, marginBottom: 4, color: '#252525' }}>جنسیت:</label>
        <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name="gender" value="" checked={gender === ''} onChange={(e) => setGender(e.target.value)} />
            نامشخص
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name="gender" value="M" checked={gender === 'M'} onChange={(e) => setGender(e.target.value)} />
            مرد
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <input type="radio" name="gender" value="F" checked={gender === 'F'} onChange={(e) => setGender(e.target.value)} />
            زن
          </label>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontWeight: 'bold', fontSize: 12, marginBottom: 4, color: '#252525' }}>توضیحات:</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="field"
          style={{ width: '100%', minHeight: 150, resize: 'vertical' }}
          placeholder="درباره خودتان بنویسید..."
        />
      </div>

      {message && (
        <div style={{
          padding: 8, borderRadius: 3, fontSize: 12, fontWeight: 'bold', marginBottom: 12,
          background: message.type === 'success' ? '#eafaf1' : '#fdedec',
          color: message.type === 'success' ? '#27ae60' : '#c0392b',
          border: `1px solid ${message.type === 'success' ? '#d5f5e3' : '#fadbd8'}`,
        }}>
          {message.text}
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
      </button>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useGameStore((s) => s.user);
  const setUser = useGameStore((s) => s.setUser);

  const playerId = searchParams.get('id');
  const isOwn = !playerId || (currentUser && String(playerId) === String(currentUser.id));

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = playerId && !isOwn ? { id: playerId } : {};
      const { data } = await api.get('game/profile/', { params });
      setData(data);
    } catch (e) {
      setError(e.response?.data?.error || 'خطا در دریافت اطلاعات پروفایل');
    } finally {
      setLoading(false);
    }
  }, [playerId, isOwn]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSendMessage = () => {
    if (!data) return;
    navigate(`/messages?to=${data.username}`);
  };

  const handleSendTroops = () => {
    if (!data || !data.villages?.length) return;
    const v = data.villages[0];
    navigate('/send-troops', { state: { targetVillageId: v.id, targetName: v.name } });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
        <div style={{ marginBottom: 8 }}>در حال بارگذاری پروفایل...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ color: '#DE0000', fontWeight: 'bold', marginBottom: 12 }}>{error}</div>
        <button onClick={() => navigate('/world-map')} className="btn-primary">بازگشت به نقشه</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
        پروفایل یافت نشد
      </div>
    );
  }

  return (
    <div className="player" style={{ direction: 'rtl', fontFamily: 'Tahoma, Arial, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#498843', color: '#fff', padding: '8px 12px', fontWeight: 'bold', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '2px 2px 0 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>پروفایل بازیکن</span>
          <span style={{ fontSize: 12, opacity: 0.9 }}>{data.username}</span>
        </div>
        {data.rank && (
          <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 3 }}>
            رتبه: #{data.rank}
          </span>
        )}
      </div>

      {/* Tabs (own profile only) */}
      {isOwn && (
        <div style={{ display: 'flex', gap: 2, padding: '8px 12px', background: '#E5E5E5', borderBottom: '1px solid #C9C9C9' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`profileTab ${activeTab === 'overview' ? 'active' : ''}`}
          >
            نمای کلی
          </button>
          <button
            onClick={() => setActiveTab('edit')}
            className={`profileTab ${activeTab === 'edit' ? 'active' : ''}`}
          >
            ویرایش پروفایل
          </button>
          <button
            onClick={() => setActiveTab('account')}
            className={`profileTab ${activeTab === 'account' ? 'active' : ''}`}
          >
            تنظیمات حساب
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ background: '#fff', border: '1px solid #C9C9C9', borderTop: 'none', padding: 12 }}>

        {/* Overview Tab */}
        {(activeTab === 'overview' || !isOwn) && (
          <div>
            {/* Hero image + Details */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {/* Hero image */}
              <div style={{ flexShrink: 0 }}>
                <HeroImage playerId={data.id} size="profile" />
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <DetailsTable data={data} />
              </div>
            </div>

            {/* Description */}
            {data.description && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f9f9f9', border: '1px solid #eee', borderRadius: 3 }}>
                <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 6, color: '#252525' }}>درباره بازیکن:</div>
                <div style={{ fontSize: 12, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{data.description}</div>
              </div>
            )}

            {/* Action buttons */}
            {!isOwn && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={handleSendMessage} className="btn-primary">پیام ارسال کن</button>
                {data.villages?.length > 0 && (
                  <button onClick={handleSendTroops} className="btn-danger">ارسال نیرو</button>
                )}
              </div>
            )}

            {/* Village list */}
            {data.villages?.length > 0 && (
              <VillageList villages={data.villages} />
            )}

            {/* Medals */}
            <MedalsSection medals={data.medals} />
          </div>
        )}

        {/* Edit Profile Tab */}
        {activeTab === 'edit' && isOwn && (
          <EditProfileTab data={data} onSave={fetchProfile} />
        )}

        {/* Account Tab */}
        {activeTab === 'account' && isOwn && (
          <AccountTab data={data} />
        )}
      </div>
    </div>
  );
}

function AccountTab({ data }) {
  const navigate = useNavigate();
  const clearUser = useGameStore((s) => s.clearUser);
  const [activeSection, setActiveSection] = useState(null);
  const [passwords, setPasswords] = useState({ old: '', new1: '', new2: '' });
  const [email, setEmail] = useState({ old: '', new: '' });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!passwords.old || !passwords.new1 || !passwords.new2) {
      setMessage({ type: 'error', text: 'لطفاً تمام فیلدها را پر کنید.' });
      return;
    }
    if (passwords.new1 !== passwords.new2) {
      setMessage({ type: 'error', text: 'رمز عبور جدید مطابقت ندارد.' });
      return;
    }
    setLoading(true);
    try {
      await api.post('auth/change-password/', passwords);
      setMessage({ type: 'success', text: 'رمز عبور با موفقیت تغییر کرد.' });
      setPasswords({ old: '', new1: '', new2: '' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'خطا در تغییر رمز عبور' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!email.old || !email.new) {
      setMessage({ type: 'error', text: 'لطفاً تمام فیلدها را پر کنید.' });
      return;
    }
    setLoading(true);
    try {
      await api.post('auth/change-email/', email);
      setMessage({ type: 'success', text: 'ایمیل با موفقیت تغییر کرد.' });
      setEmail({ old: '', new: '' });
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'خطا در تغییر ایمیل' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید حساب خود را حذف کنید؟ این عمل غیرقابل بازگشت است.')) return;
    setLoading(true);
    try {
      await api.post('auth/delete-account/');
      clearUser();
      navigate('/login');
    } catch (e) {
      setMessage({ type: 'error', text: e.response?.data?.error || 'خطا در حذف حساب' });
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 12, color: '#252525' }}>تنظیمات حساب کاربری</div>

      {/* Gold info */}
      <div style={{ padding: 10, background: '#fdf3e8', border: '1px solid #F88C1F', borderRadius: 3, marginBottom: 16, fontSize: 12 }}>
        <strong>طلا:</strong> {data.gold_coins} | <strong>نقره:</strong> {data.silver_coins}
        {data.has_plus && <span style={{ marginRight: 8, color: '#228B22', fontWeight: 'bold' }}>⭐ پلاس فعال</span>}
      </div>

      {/* Change Password */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setActiveSection(activeSection === 'password' ? null : 'password')}
          style={{ background: '#E5E5E5', border: '1px solid #C9C9C9', padding: '6px 12px', fontWeight: 'bold', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'right', borderRadius: activeSection === 'password' ? '3px 3px 0 0' : 3 }}
        >
          تغییر رمز عبور
        </button>
        {activeSection === 'password' && (
          <div style={{ border: '1px solid #C9C9C9', borderTop: 'none', padding: 12, borderRadius: '0 0 3px 3px' }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 2, fontWeight: 'bold' }}>رمز عبور فعلی:</label>
              <input type="password" value={passwords.old} onChange={(e) => setPasswords(p => ({ ...p, old: e.target.value }))} className="field" style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 2, fontWeight: 'bold' }}>رمز عبور جدید:</label>
              <input type="password" value={passwords.new1} onChange={(e) => setPasswords(p => ({ ...p, new1: e.target.value }))} className="field" style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 2, fontWeight: 'bold' }}>تکرار رمز عبور جدید:</label>
              <input type="password" value={passwords.new2} onChange={(e) => setPasswords(p => ({ ...p, new2: e.target.value }))} className="field" style={{ width: '100%' }} />
            </div>
            <button onClick={handleChangePassword} disabled={loading} className="btn-primary">
              {loading ? 'در حال تغییر...' : 'تغییر رمز عبور'}
            </button>
          </div>
        )}
      </div>

      {/* Change Email */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setActiveSection(activeSection === 'email' ? null : 'email')}
          style={{ background: '#E5E5E5', border: '1px solid #C9C9C9', padding: '6px 12px', fontWeight: 'bold', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'right', borderRadius: activeSection === 'email' ? '3px 3px 0 0' : 3 }}
        >
          تغییر ایمیل
        </button>
        {activeSection === 'email' && (
          <div style={{ border: '1px solid #C9C9C9', borderTop: 'none', padding: 12, borderRadius: '0 0 3px 3px' }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 2, fontWeight: 'bold' }}>ایمیل فعلی:</label>
              <input type="email" value={email.old} onChange={(e) => setEmail(p => ({ ...p, old: e.target.value }))} className="field" style={{ width: '100%' }} />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 11, marginBottom: 2, fontWeight: 'bold' }}>ایمیل جدید:</label>
              <input type="email" value={email.new} onChange={(e) => setEmail(p => ({ ...p, new: e.target.value }))} className="field" style={{ width: '100%' }} />
            </div>
            <button onClick={handleChangeEmail} disabled={loading} className="btn-primary">
              {loading ? 'در حال تغییر...' : 'تغییر ایمیل'}
            </button>
          </div>
        )}
      </div>

      {/* Delete Account */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setActiveSection(activeSection === 'delete' ? null : 'delete')}
          style={{ background: '#E5E5E5', border: '1px solid #C9C9C9', padding: '6px 12px', fontWeight: 'bold', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'right', borderRadius: activeSection === 'delete' ? '3px 3px 0 0' : 3, color: '#DE0000' }}
        >
          حذف حساب کاربری
        </button>
        {activeSection === 'delete' && (
          <div style={{ border: '1px solid #C9C9C9', borderTop: 'none', padding: 12, borderRadius: '0 0 3px 3px' }}>
            <div style={{ padding: 8, background: '#fdedec', border: '1px solid #fadbd8', borderRadius: 3, marginBottom: 12, fontSize: 12, color: '#c0392b' }}>
              ⚠️ هشدار: حذف حساب غیرقابل بازگشت است. تمام اطلاعات شما包括村庄ها، نیروها، و منابع حذف خواهند شد.
            </div>
            <button onClick={handleDeleteAccount} disabled={loading} className="btn-danger">
              {loading ? 'در حال حذف...' : 'حذف حساب'}
            </button>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: 8, borderRadius: 3, fontSize: 12, fontWeight: 'bold', marginTop: 12,
          background: message.type === 'success' ? '#eafaf1' : '#fdedec',
          color: message.type === 'success' ? '#27ae60' : '#c0392b',
          border: `1px solid ${message.type === 'success' ? '#d5f5e3' : '#fadbd8'}`,
        }}>
          {message.text}
        </div>
      )}
    </div>
  );
}
