import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';

const TRIBES = [
    { id: 'ROMAN', name: 'رومیان', desc: 'ارتش منظم و ساختمان‌های قوی', img: '/assets/tribes/roman-splash.gif' },
    { id: 'TEUTON', name: 'توتون‌ها', desc: 'جنگجویان قدرتمند و مهاجم', img: '/assets/tribes/teuton-splash.gif' },
    { id: 'GAUL', name: 'گل‌ها', desc: 'دفاع قوی و سرعت بالا', img: '/assets/tribes/gaul-splash.gif' },
];

const LOCATIONS = [
    { id: 'RANDOM', label: 'تصادفی' },
    { id: 'NW', label: 'شمال غرب' },
    { id: 'NE', label: 'شمال شرق' },
    { id: 'SW', label: 'جنوب غرب' },
    { id: 'SE', label: 'جنوب شرق' },
];

export default function Register() {
    const navigate = useNavigate();
    const accessToken = useGameStore((s) => s.accessToken);

    const [form, setForm] = useState({ username: '', email: '', password: '', phone_number: '' });
    const [tribe, setTribe] = useState('');
    const [startingLocation, setStartingLocation] = useState('RANDOM');
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [captchaImg, setCaptchaImg] = useState('');
    const [captchaKey, setCaptchaKey] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');

    const fetchCaptcha = async () => {
        try {
            const { data } = await api.get('auth/captcha/');
            setCaptchaImg(data.image);
            setCaptchaKey(data.token);
        } catch { /* ignore */ }
    };

    useEffect(() => {
        document.body.className = 'v35 webkit chrome signup';
        if (accessToken) { navigate('/village', { replace: true }); return; }
        fetchCaptcha();
        return () => { document.body.className = ''; };
    }, [accessToken, navigate]);

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.username || !form.email || !form.password) {
            setError('لطفا تمام فیلدها را پر کنید.');
            return;
        }
        if (!tribe) {
            setError('لطفا یک نژاد انتخاب کنید.');
            return;
        }
        if (!agreed) {
            setError('باید قوانین بازی را بپذیرید.');
            return;
        }

        setLoading(true);
        try {
            await api.post('auth/register/', {
                username: form.username,
                email: form.email,
                password: form.password,
                phone_number: form.phone_number || '',
                tribe: tribe,
                starting_location: startingLocation,
                accept_terms: agreed,
                captcha_token: captchaKey,
                captcha_answer: captchaAnswer,
            });
            navigate('/login', { replace: true });
        } catch (err) {
            const data = err.response?.data;
            if (data) {
                const msgs = Object.values(data).flat().join(' ');
                setError(msgs || 'خطا در ثبت نام.');
                fetchCaptcha();
            } else {
                setError('خطا در ثبت نام.');
            }
        } finally { setLoading(false); }
    };

    const inputStyle = { background: '#F8F8F8', border: '1px solid #99C01A', fontSize: 11, padding: '2px 4px', width: 200 };

    return (
        <div className="v35 webkit chrome signup">
            <div id="wrapper">
                <img id="staticElements" alt="" />
                <div className="bodyWrapper">
                    <div id="header">
                        <div id="mtop">
                            <a id="logo" href="/" title="Travian"></a>
                            <div className="clear"></div>
                        </div>
                    </div>
                    <div id="mid">
                        <div id="side_navi">
                            <ul>
                                <li><a href="/" title="خانه">خانه</a></li>
                                <li><a href="/login" title="ورود">ورود</a></li>
                                <li className="active"><a href="/register" title="ثبت نام">ثبت نام</a></li>
                                <li className="support"><a href="#" title="پشتیبانی">پشتیبانی</a></li>
                            </ul>
                        </div>
                        <div className="clear"></div>
                        <div id="contentOuterContainer">
                            <div className="contentTitle">&nbsp;</div>
                            <div className="contentContainer">
                                <div id="content" className="signup">
                                    <h1 className="titleInHeader">ثبت نام</h1>

                                    <form onSubmit={handleRegister}>
                                        <h4 className="round">اطلاعات کاربری</h4>
                                        <table cellPadding="1" cellSpacing="1" id="sign_input" className="transparent" style={{ width: '100%' }}>
                                            <tbody>
                                                <tr className="top">
                                                    <th style={{ width: 120, textAlign: 'right', paddingRight: 8 }}>نام کاربری</th>
                                                    <td><input className="text" type="text" name="username" value={form.username} onChange={handleChange} maxLength={15} style={inputStyle} /></td>
                                                </tr>
                                                <tr>
                                                    <th style={{ textAlign: 'right', paddingRight: 8 }}>ایمیل</th>
                                                    <td><input className="text" type="email" name="email" value={form.email} onChange={handleChange} maxLength={40} style={inputStyle} /></td>
                                                </tr>
                                                <tr>
                                                    <th style={{ textAlign: 'right', paddingRight: 8 }}>رمز عبور</th>
                                                    <td><input className="text" type="password" name="password" value={form.password} onChange={handleChange} maxLength={20} style={inputStyle} /></td>
                                                </tr>
                                                <tr>
                                                    <th style={{ textAlign: 'right', paddingRight: 8 }}>شماره تلفن</th>
                                                    <td><input className="text" type="text" name="phone_number" value={form.phone_number} onChange={handleChange} maxLength={15} style={inputStyle} placeholder="اختیاری" /></td>
                                                </tr>
                                                <tr>
                                                    <th style={{ textAlign: 'right', paddingRight: 8 }}>کد امنیتی</th>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                                            {captchaImg ? (
                                                                <img src={captchaImg} alt="captcha" onClick={fetchCaptcha} title="کلیک برای بروزرسانی"
                                                                    style={{ height: 40, width: 160, borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer', objectFit: 'contain' }} />
                                                            ) : (
                                                                <div style={{ height: 40, width: 160, background: '#eee', border: '1px solid #ccc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#999' }}>در حال بارگذاری...</div>
                                                            )}
                                                            <button type="button" onClick={fetchCaptcha} style={{ background: '#498843', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }} title="بروزرسانی کپچا">بروزرسانی</button>
                                                        </div>
                                                        <input className="text" type="text" value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} maxLength={10} style={{ ...inputStyle, width: 120 }} placeholder="کد را وارد کنید" />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <h4 className="round" style={{ marginTop: 16 }}>یک نژاد انتخاب کنید</h4>
                                        <div className="boxes boxGrey boxesColor gray" style={{ width: '100%' }}>
                                            <div className="boxes-tl"></div><div className="boxes-tr"></div><div className="boxes-tc"></div>
                                            <div className="boxes-ml"></div><div className="boxes-mr"></div><div className="boxes-mc"></div>
                                            <div className="boxes-bl"></div><div className="boxes-br"></div><div className="boxes-bc"></div>
                                            <div className="boxes-contents">
                                                <div className="tribeSelect" style={{ display: 'flex', gap: 12, padding: '8px 0' }}>
                                                    {TRIBES.map((t) => (
                                                        <div key={t.id} className={`tribe ${t.id.toLowerCase()}`}
                                                            onClick={() => setTribe(t.id)}
                                                            style={{
                                                                textAlign: 'center', cursor: 'pointer', flex: 1,
                                                                border: tribe === t.id ? '3px solid #99C01A' : '3px solid transparent',
                                                                borderRadius: 6, padding: 8, transition: 'all 0.2s',
                                                                background: tribe === t.id ? 'rgba(153,192,26,0.1)' : 'transparent',
                                                            }}>
                                                            <input type="radio" name="vid" value={t.id} checked={tribe === t.id} onChange={() => setTribe(t.id)} style={{ display: 'none' }} />
                                                            <img src={t.img} alt={t.name} style={{ width: '100%', height: 80, objectFit: 'contain', marginBottom: 4 }} />
                                                            <div style={{ fontWeight: 'bold', fontSize: 13, color: tribe === t.id ? '#498843' : '#333' }}>{t.name}</div>
                                                            <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{t.desc}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <h4 className="round" style={{ marginTop: 16 }}>موقعیت شروع</h4>
                                        <div className="boxes boxGrey boxesColor gray" style={{ width: '100%' }}>
                                            <div className="boxes-tl"></div><div className="boxes-tr"></div><div className="boxes-tc"></div>
                                            <div className="boxes-ml"></div><div className="boxes-mr"></div><div className="boxes-mc"></div>
                                            <div className="boxes-bl"></div><div className="boxes-br"></div><div className="boxes-bc"></div>
                                            <div className="boxes-contents">
                                                <div style={{ padding: '8px 0', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                                                    {LOCATIONS.map((loc) => (
                                                        <label key={loc.id} style={{ cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                                                            <input type="radio" name="kid" value={loc.id} checked={startingLocation === loc.id} onChange={() => setStartingLocation(loc.id)} />
                                                            {loc.label}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <h4 className="round" style={{ marginTop: 16, cursor: 'pointer' }} onClick={() => setShowRules(!showRules)}>
                                            {showRules ? '▼' : '▶'} مهم: قبل از ثبت نام با دقت بخوانید
                                        </h4>
                                        {showRules && (
                                            <div className="boxes boxGrey boxesColor gray" style={{ width: '100%', marginBottom: 12 }}>
                                                <div className="boxes-tl"></div><div className="boxes-tr"></div><div className="boxes-tc"></div>
                                                <div className="boxes-ml"></div><div className="boxes-mr"></div><div className="boxes-mc"></div>
                                                <div className="boxes-bl"></div><div className="boxes-br"></div><div className="boxes-bc"></div>
                                                <div className="boxes-contents">
                                                    <div style={{ height: 300, overflow: 'auto', border: '1px dashed #999', padding: 12, fontSize: 12, lineHeight: '20px', textAlign: 'justify' }}>
                                                        <p><b>§1 رمز اکانت، ثبت نام و مالکیت</b></p>
                                                        <p>هر بازیکنی تنها می‌تواند یک اکانت در هر جهان بازی (سرور) داشته باشد.</p>
                                                        <p><br/></p>
                                                        <p><b>§1.1 ثبت نام</b></p>
                                                        <p>ایمیلی که برای ثبت نام استفاده می‌شود باید یک ایمیل شخصی بوده و ثبت نام کننده باید دسترسی کامل و کنترل کامل این ایمیل را داشته باشد.</p>
                                                        <p><br/></p>
                                                        <p><b>§1.2 رمز اکانت</b></p>
                                                        <p>صاحب اکانت نمی‌تواند رمز خود را به بازیکنی که در همان جهان بازی (سرور) اکانت دارد بدهد.</p>
                                                        <p><br/></p>
                                                        <p><b>§3 استفاده از برنامه‌های خارجی</b></p>
                                                        <p>استفاده از هر نرم افزار جهت ارسال کلیک و انجام بازی به صورت اتوماتیک ممنوع بوده و اکانت فرد خاطی مسدود خواهد شد.</p>
                                                        <p><br/></p>
                                                        <p><b>§5 تبادل پول</b></p>
                                                        <p>هر گونه خرید و فروش که در آن پول واقعی رد و بدل شود خلاف است.</p>
                                                        <p><br/></p>
                                                        <p><b>§6 رفتار و رعایت حقوق اجتماعی</b></p>
                                                        <p>تمامی افراد باید با لفظی مودبانه با یکدیگر برخورد کنند. زبان فارسی و انگلیسی تنها زبان‌های قابل قبول می‌باشند.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="checks" style={{ margin: '12px 0', fontSize: 12 }}>
                                            <label style={{ cursor: 'pointer' }}>
                                                <input type="checkbox" className="check" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginLeft: 6 }} />
                                                من قوانین را خوانده و قبول دارم.
                                            </label>
                                        </div>

                                        {error && <div style={{ color: '#DE0000', fontSize: 12, fontWeight: 'bold', marginBottom: 8 }}>{error}</div>}

                                        <div className="btn" style={{ textAlign: 'center', marginTop: 16 }}>
                                            <button type="submit" disabled={loading} style={{
                                                background: loading ? '#ccc' : '#498843', color: '#fff', border: 'none',
                                                borderRadius: 4, padding: '10px 32px', fontWeight: 'bold', fontSize: 14,
                                                cursor: loading ? 'not-allowed' : 'pointer',
                                            }}>
                                                {loading ? 'در حال ثبت نام...' : 'ثبت نام'}
                                            </button>
                                        </div>
                                    </form>

                                    <div className="clear" style={{ marginTop: 16 }}></div>
                                    <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
                                        قبلا ثبت نام کرده‌اید؟{' '}
                                        <Link to="/login" style={{ color: '#99C01A', fontWeight: 'bold' }}>وارد شوید</Link>
                                    </div>
                                </div>
                            </div>
                            <div className="contentFooter">&nbsp;</div>
                        </div>
                    </div>
                </div>
                <div id="ce"></div>
            </div>
        </div>
    );
}
