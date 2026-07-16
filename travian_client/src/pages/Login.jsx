import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";
import useGameStore from "../store/useGameStore";

export default function Login() {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [captchaAnswer, setCaptchaAnswer] = useState("");
    const [captcha, setCaptcha] = useState({ token: "", image: "" });
    const [captchaLoading, setCaptchaLoading] = useState(true);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState("");
    const [forgotMsg, setForgotMsg] = useState("");

    const navigate = useNavigate();
    const setUser = useGameStore((s) => s.setUser);
    const setAccessToken = useGameStore((s) => s.setAccessToken);

    const fetchCaptcha = useCallback(async () => {
        setCaptchaLoading(true);
        setCaptchaAnswer("");
        try {
            const { data } = await api.get("auth/captcha/");
            setCaptcha(data);
        } catch (err) {
            console.error(err);
        } finally {
            setCaptchaLoading(false);
        }
    }, []);

    useEffect(() => { fetchCaptcha(); }, [fetchCaptcha]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { data } = await api.post("auth/login/", {
                username: login, password,
                captcha_token: captcha.token, captcha_answer: captchaAnswer,
            });
            setAccessToken(data.access);
            setUser(data.user);
            navigate("/village");
        } catch (err) {
            if (err.response?.status === 429) {
                setError("تعداد تلاش‌های شما زیاد بوده؛ لطفا کمی صبر کنید.");
            } else {
                setError(
                    err.response?.data?.captcha_answer?.[0] ||
                    err.response?.data?.non_field_errors?.[0] ||
                    "نام کاربری یا رمز عبور اشتباه است"
                );
            }
            fetchCaptcha();
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setForgotMsg("");
        try {
            await api.post("auth/forgot-password/", { email: forgotEmail });
            setForgotMsg("ایمیل بازیابی رمز عبور برای شما ارسال شد.");
        } catch (err) {
            setForgotMsg(err.response?.data?.error || "خطا در ارسال ایمیل");
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#A1BB79', direction: 'rtl' }}>
            {/* Background */}
            <div style={{
                width: '100%',
                minHeight: '100vh',
                backgroundImage: "url('/assets/bgs/bgOutside-rtl.jpg')",
                backgroundPosition: 'center top',
                backgroundRepeat: 'no-repeat',
            }}>
                {/* Header with logo */}
                <div id="header" style={{ height: '115px' }}>
                    <div id="mtop" style={{ margin: '0 auto', width: '990px', position: 'relative' }}>
                        <a id="logo" href="/" title="Travian" />
                        <div className="clear" />
                    </div>
                </div>

                {/* Main content */}
                <div id="mid" style={{ margin: '9px auto 0', minHeight: '500px', width: '990px', position: 'relative' }}>
                    {/* Side navigation */}
                    <div id="side_navi">
                        <ul>
                            <li><a href="/">خانه</a></li>
                            <li className="active"><a href="/login">ورود</a></li>
                            <li><a href="/register">ثبت‌نام</a></li>
                            <li><a href="#">انجمن</a></li>
                            <li><a href="#">پشتیبانی</a></li>
                        </ul>
                    </div>
                    <div className="clear" />

                    {/* Content area */}
                    <div id="contentOuterContainer">
                        <div className="contentTitle">&nbsp;</div>
                        <div className="contentContainer">
                            <div id="content" className="login" style={{ padding: '23px 23px 26px 23px' }}>
                                <h1 style={{ fontSize: '18px', marginBottom: '8px' }}>ورود به بازی</h1>

                                {error && (
                                    <div style={{ background: '#fcd1d1', border: '1px solid #DE0000', color: '#DE0000', padding: '10px', marginBottom: '15px', fontSize: '12px', fontWeight: 'bold' }}>
                                        {error}
                                    </div>
                                )}

                                <div className="outerLoginBox">
                                    <h2>خوش آمدید</h2>

                                    <div className="innerLoginBox">
                                        <form onSubmit={handleLogin}>
                                            <table className="loginTable">
                                                <tbody>
                                                    <tr className="account">
                                                        <td className="accountNameOrEmailAddress" style={{ paddingBottom: '15px' }}>نام کاربری</td>
                                                        <td style={{ paddingBottom: '15px' }}>
                                                            <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} className="text" style={{ width: '175px' }} required />
                                                            <div style={{ height: '15px', fontSize: '11px', color: '#DE0000' }}>&nbsp;</div>
                                                        </td>
                                                    </tr>
                                                    <tr className="pass">
                                                        <td style={{ paddingBottom: '20px' }}>رمز عبور</td>
                                                        <td style={{ paddingBottom: '20px' }}>
                                                            <input type="password" maxLength={20} value={password} onChange={(e) => setPassword(e.target.value)} className="text" style={{ width: '175px' }} required />
                                                            <div style={{ height: '15px', fontSize: '11px', color: '#DE0000' }}>&nbsp;</div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ verticalAlign: 'top', paddingTop: '3px' }}>تایید امنیتی</td>
                                                        <td>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                                {captchaLoading ? (
                                                                    <div style={{ width: '128px', height: '52px', background: '#E5E5E5' }} />
                                                                ) : (
                                                                    <img src={captcha.image} alt="کپچا" style={{ border: '1px solid #CCC' }} />
                                                                )}
                                                                <button type="button" onClick={fetchCaptcha} style={{ background: 'none', border: 'none', color: '#99C01A', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                                                    🔄 تصویر جدید
                                                                </button>
                                                            </div>
                                                            <input type="text" required value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} placeholder="کد داخل تصویر" className="text" style={{ width: '175px', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }} />
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td></td>
                                                        <td style={{ paddingTop: '25px' }}>
                                                            <button type="submit" disabled={loading} className="btn-primary">
                                                                {loading ? "در حال ورود..." : "ورود به بازی"}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </form>
                                    </div>
                                </div>

                                {/* Forgot password */}
                                <div className="greenbox">
                                    <div className="greenbox-top" />
                                    <div className="greenbox-content">
                                        <button onClick={() => setShowForgot(!showForgot)} style={{ background: 'none', border: 'none', color: '#228B22', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', padding: '10px 15px' }}>
                                            {showForgot ? '▲ بستن' : '▼ رمز عبور را فراموش کرده‌اید؟'}
                                        </button>

                                        {showForgot && (
                                            <div style={{ padding: '0 15px 15px 15px' }}>
                                                <form onSubmit={handleForgotPassword} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                                    <input type="email" required className="text" style={{ width: '250px' }} placeholder="ایمیل خود را وارد کنید" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} />
                                                    <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>ارسال لینک بازیابی</button>
                                                </form>
                                                {forgotMsg && (
                                                    <p style={{ fontSize: '11px', marginTop: '10px', color: '#228B22', fontWeight: 'bold' }}>{forgotMsg}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="greenbox-bottom" />
                                    <div className="clear" />
                                </div>

                                <div style={{ fontSize: '12px', marginTop: '15px' }}>
                                    <span>اکانت ندارید؟ </span>
                                    <a href="/register">ثبت‌نام</a>
                                </div>
                            </div>
                        </div>
                        <div className="contentFooter">&nbsp;</div>
                    </div>
                </div>

                {/* Footer */}
                <div id="footer">
                    <div id="mfoot">
                        <a href="/">خانه</a>
                        <a href="#">انجمن</a>
                        <a href="/login">ورود</a>
                        <a href="/register">ثبت‌نام</a>
                        <a href="#">پشتیبانی</a>
                        <div className="clear" />
                    </div>
                    <p style={{ marginTop: '10px' }}>&copy; {new Date().getFullYear()} تمامی حقوق محفوظ است</p>
                </div>
            </div>
        </div>
    );
}
