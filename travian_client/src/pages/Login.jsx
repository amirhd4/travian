import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import Footer from '../components/Footer';

function formatPersianDate(isoDate) {
    if (!isoDate) return '---';
    try {
        const d = new Date(isoDate);
        const opts = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tehran' };
        const parts = new Intl.DateTimeFormat('fa-IR', opts).formatToParts(d);
        const get = (type) => parts.find(p => p.type === type)?.value || '';
        return `${get('year')}/${get('month')}/${get('day')} - ${get('hour')}:${get('minute')}`;
    } catch {
        return '---';
    }
}

export default function Login() {
    const navigate = useNavigate();
    const accessToken = useGameStore((s) => s.accessToken);
    const setAccessToken = useGameStore((s) => s.setAccessToken);
    const setUser = useGameStore((s) => s.setUser);
    const setVillages = useGameStore((s) => s.setVillages);
    const setActiveVillageId = useGameStore((s) => s.setActiveVillageId);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotMsg, setForgotMsg] = useState('');

    const [captchaImage, setCaptchaImage] = useState('');
    const [captchaToken, setCaptchaToken] = useState('');
    const [captchaAnswer, setCaptchaAnswer] = useState('');

    const [serverInfo, setServerInfo] = useState({ server_speed: '---', start_date: null, server_end_at: null });

    const loadCaptcha = async () => {
        const { data } = await api.get('auth/captcha/');
        setCaptchaImage(data.image);
        setCaptchaToken(data.token);
    };

    useEffect(() => {
        loadCaptcha();
        api.get('game/server-status/').then(({ data }) => {
            setServerInfo({
                server_speed: data.server_speed || '---',
                start_date: data.start_date,
                server_end_at: data.server_end_at,
            });
        }).catch(() => {});
    }, []);

    useEffect(() => {
        document.body.className = 'v35 webkit chrome login';
        if (accessToken) navigate('/village', { replace: true });
        return () => { document.body.className = ''; };
    }, [accessToken, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username || !password) { setError('نام کاربری و رمز عبور را وارد کنید.'); return; }
        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('auth/login/', { username, password, captcha_token: captchaToken, captcha_answer: captchaAnswer });
            setAccessToken(data.access);
            const me = await api.get('auth/me/');
            setUser(me.data);
            const villagesRes = await api.get('game/villages/');
            setVillages(villagesRes.data);
            const capital = villagesRes.data.find((v) => v.is_capital) || villagesRes.data[0];
            if (capital) setActiveVillageId(capital.id);
            navigate('/village', { replace: true });
        } catch (err) {
            const data = err.response?.data;
            const msg = data ? Object.values(data).flat().join(' ') : 'نام کاربری یا رمز عبور اشتباه است.';
            setError(msg);
            loadCaptcha();
            setCaptchaAnswer('');
        } finally { setLoading(false); }
    };

    const handleForgot = async (e) => {
        e.preventDefault();
        if (!forgotEmail) return;
        try {
            await api.post('auth/password-reset/', { email: forgotEmail });
            setForgotMsg('ایمیل بازیابی رمز عبور ارسال شد.');
        } catch {
            setForgotMsg('خطا در ارسال ایمیل.');
        }
    };

    return (
        <div className="v35 webkit chrome login">
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
                        <div className="clear"></div>

                        <div className="login-layout">
                            {/* ── Left signs (2) ── */}
                            <div className="login-signs-left">

                                <div id="side_navi">
                                    <ul>
                                        <li><a href="/" title="خانه">خانه</a></li>
                                        <li className="active"><a href="/login" title="ورود">ورود</a></li>
                                        <li><a href="/register" title="ثبت نام">ثبت نام</a></li>
                                        <li className="support"><a href="#" title="پشتیبانی">پشتیبانی</a></li>
                                    </ul>
                                </div>

                                {/* Sign 1: Warning */}
                                <div className="login-sign-item">
                                    <img src="/assets/layout/signQuestmaster-rtl.png" alt="" />
                                    <div className="login-sign-text">
                                        <h4>توجه:</h4>
                                        هرگونه توهین و فحاشی به بازیکنان خلاف قوانین بازی بوده و با بازیکن خاطی به شدت برخورد خواهد شد.
                                    </div>
                                </div>
                            </div>

                            {/* ── Center: Login box ── */}
                            <div id="contentOuterContainer" style={{ flexShrink: 0 }}>
                                <div className="contentTitle">&nbsp;</div>
                                <div className="contentContainer">
                                    <div id="content" className="login">
                                        <h1 className="titleInHeader">ورود</h1>

                                        <div className="outerLoginBox">
                                            <h2>به بازی خوش آمدید</h2>
                                            <div className="innerLoginBox">
                                                <form onSubmit={handleLogin}>
                                                    <table className="transparent loginTable">
                                                        <tbody>
                                                            <tr className="account">
                                                                <td className="accountNameOrEmailAddress">نام کاربری</td>
                                                                <td>
                                                                    <input type="text" className="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} autoFocus />
                                                                </td>
                                                            </tr>
                                                            <tr className="pass">
                                                                <td>رمز عبور</td>
                                                                <td>
                                                                    <input type="password" className="text" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={20} />
                                                                </td>
                                                            </tr>
                                                            {error && (
                                                                <tr>
                                                                    <td></td>
                                                                    <td><div style={{ color: '#DE0000', fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>{error}</div></td>
                                                                </tr>
                                                            )}
                                                            <tr>
                                                                <td>کپچا</td>
                                                                <td>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                                                        <img
                                                                            src={captchaImage}
                                                                            alt="captcha"
                                                                            onClick={loadCaptcha}
                                                                            style={{ height: 60, width: 220, borderRadius: 4, border: '1px solid #ccc', cursor: 'pointer', objectFit: 'contain' }}

                                                                        />
                                                                        <button type="button" onClick={loadCaptcha} style={{ background: '#498843', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }} title="بروزرسانی کپچا">بروزرسانی</button>
                                                                    </div>
                                                                    <input
                                                                        type="text"
                                                                        className="text"
                                                                        value={captchaAnswer}
                                                                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                                                                        placeholder="اعداد را وارد کنید"
                                                                    />
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td></td>
                                                                <td>
                                                                    <button type="submit" disabled={loading} style={{
                                                                        background: loading ? '#ccc' : '#498843',
                                                                        color: '#fff',
                                                                        border: 'none',
                                                                        borderRadius: 4,
                                                                        padding: '8px 24px',
                                                                        fontWeight: 'bold',
                                                                        fontSize: 13,
                                                                        cursor: loading ? 'not-allowed' : 'pointer',
                                                                        marginTop: 8,
                                                                    }}>
                                                                        {loading ? 'در حال ورود...' : 'ورود'}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </form>
                                            </div>
                                        </div>

                                        <div className="greenbox passwordForgotten">
                                            <div className="greenbox-top"></div>
                                            <div className="greenbox-content">
                                                <div className="passwordForgottenLink">
                                                    <a onClick={() => setShowForgot(!showForgot)} href="#" className="showPWForgottenLink" style={{ cursor: 'pointer' }}>
                                                        {showForgot ? '▲' : '▼'} رمز عبور را فراموش کرده‌اید؟
                                                    </a>
                                                </div>
                                                {showForgot && (
                                                    <div className="showPasswordForgotten">
                                                        {forgotMsg ? (
                                                            <div style={{ color: '#008000', padding: '8px 0', fontWeight: 'bold' }}>{forgotMsg}</div>
                                                        ) : (
                                                            <form onSubmit={handleForgot}>
                                                                <div className="forgotPasswordDescription">ایمیل خود را وارد کنید تا لینک بازیابی رمز عبور برایتان ارسال شود.</div>
                                                                <table className="transparent pwForgottenTable" cellPadding="0" cellSpacing="0">
                                                                    <tbody>
                                                                        <tr className="mail">
                                                                            <th>ایمیل</th>
                                                                            <td>
                                                                                <input className="text" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} style={{ background: '#F8F8F8', border: '1px solid #99C01A', fontSize: 11, padding: '2px 4px', width: 200 }} />
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td></td>
                                                                            <td>
                                                                                <button type="submit" style={{ background: '#498843', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 16px', fontWeight: 'bold', fontSize: 12, cursor: 'pointer', marginTop: 6 }}>ارسال</button>
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </form>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="greenbox-bottom"></div>
                                            <div className="clear"></div>
                                        </div>

                                        <div className="clear" style={{ marginTop: 16 }}></div>

                                        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12 }}>
                                            حساب کاربری ندارید؟{' '}
                                            <Link to="/register" style={{ color: '#99C01A', fontWeight: 'bold' }}>ثبت نام کنید</Link>
                                        </div>
                                    </div>
                                </div>
                                <div className="contentFooter">&nbsp;</div>
                            </div>

                            {/* ── Right sign (1) ── */}
                            <div className="login-signs-right">
                                <div className="login-sign-item">
                                    <img src="/assets/layout/signQuestmaster-rtl.png" alt="" />
                                    <div className="login-sign-text">
                                        <h4>سرعت سرور: <span className="sign-bold">{serverInfo.server_speed}</span></h4>
                                        <hr className="sign-divider" />
                                        <div style={{ marginTop: 4 }}><h4>شروع سرور</h4></div>
                                        <div className="sign-bold">{formatPersianDate(serverInfo.start_date)}</div>
                                        <hr className="sign-divider" />
                                        <div style={{ marginTop: 4 }}><h4>پایان سرور</h4></div>
                                        <div className="sign-bold">{formatPersianDate(serverInfo.server_end_at)}</div>
                                    </div>
                                </div>
                                {/* Sign 2: Prizes */}
                                <div className="login-sign-item">
                                    <img src="/assets/layout/signQuestmaster-rtl.png" alt="" />
                                    <div className="login-sign-text">
                                        <h4>جایزه بازیکن برنده</h4>
                                        10000 طلا
                                        <hr className="sign-divider" />
                                        <h4>جایزه اتحاد برنده</h4>
                                        هر بازیکن 500 طلا
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                <div id="ce"></div>
            </div>
            <Footer />
        </div>
    );
}
