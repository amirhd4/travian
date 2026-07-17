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

    useEffect(() => {
        document.body.className = "login";
        return () => { document.body.className = ""; };
    }, []);

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
        <div>
            <div id="wrapper">
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
                                <li><a href="/">صفحه اصلی</a></li>
                                <li className="active"><a href="/login">ورود</a></li>
                                <li><a href="/register">ثبت‌نام</a></li>
                                <li><a href="#">راهنمای بازی</a></li>
                            </ul>
                        </div>
                        <div className="clear"></div>

                        <div id="contentOuterContainer">
                            <div className="contentTitle">&nbsp;</div>
                            <div className="contentContainer">
                                <div id="content" className="login">

                                    <h1>ورود</h1>

                                    {error && (
                                        <div className="error" style={{ marginBottom: '10px', textAlign: 'right' }}>{error}</div>
                                    )}

                                    <div className="outerLoginBox">
                                        <h2 style={{ textAlign: 'right' }}>خوش آمدید</h2>
                                        <div className="innerLoginBox">
                                            <form onSubmit={handleLogin}>
                                                <table>
                                                    <tbody>
                                                        <tr className="account">
                                                            <td style={{ width: '38%', paddingRight: '20px', textAlign: 'right' }}>نام کاربری</td>
                                                            <td style={{ width: '62%' }}>
                                                                <input type="text" name="user" value={login} onChange={(e) => setLogin(e.target.value)} className="text" style={{ width: '113px' }} />
                                                                <div className="error RTL" style={{ height: '15px', fontSize: '11px' }}>&nbsp;</div>
                                                            </td>
                                                        </tr>
                                                        <tr className="pass">
                                                            <td style={{ width: '38%', paddingRight: '20px', textAlign: 'right' }}>رمز عبور</td>
                                                            <td style={{ width: '62%' }}>
                                                                <input type="password" name="pw" maxLength={20} value={password} onChange={(e) => setPassword(e.target.value)} className="text" style={{ width: '113px' }} />
                                                                <br />
                                                                <div className="error RTL" style={{ height: '15px', fontSize: '11px' }}>&nbsp;</div>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td style={{ width: '38%', paddingRight: '20px', textAlign: 'right', verticalAlign: 'top', paddingTop: '3px' }}>کد امنیتی</td>
                                                            <td style={{ width: '62%' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                                                    {captchaLoading ? (
                                                                        <div style={{ width: '128px', height: '52px', background: '#E5E5E5' }} />
                                                                    ) : (
                                                                        <img src={captcha.image} alt="کپچا" style={{ border: '1px solid #CCC' }} />
                                                                    )}
                                                                    <button type="button" onClick={fetchCaptcha} className="refreshCaptcha">
                                                                        تصویر جدید
                                                                    </button>
                                                                </div>
                                                                <input type="text" required value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} placeholder="کد داخل تصویر" className="text" style={{ width: '113px', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }} />
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td></td>
                                                            <td>
                                                                <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '15px' }}>
                                                                    {loading ? "در حال ورود..." : "ورود"}
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
                                                <a onClick={() => setShowForgot(!showForgot)} href="#" className="showPWForgottenLink">
                                                    {showForgot ? '▲ بستن' : '▼ رمز عبور را فراموشی کرده‌اید؟'}
                                                </a>
                                            </div>
                                            {showForgot && (
                                                <div className="showPasswordForgotten">
                                                    <form onSubmit={handleForgotPassword}>
                                                        <div className="forgotPasswordDescription">ایمیل خود را وارد کنید تا لینک بازیابی رمز عبور برایتان ارسال شود.</div>
                                                        <table className="pwForgottenTable">
                                                            <tbody>
                                                                <tr className="mail">
                                                                    <th>ایمیل</th>
                                                                    <td>
                                                                        <input className="text" type="email" required value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} style={{ width: '113px' }} />
                                                                    </td>
                                                                </tr>
                                                                <tr>
                                                                    <td></td>
                                                                    <td>
                                                                        <button type="submit" className="btn-primary">ارسال لینک بازیابی</button>
                                                                    </td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </form>
                                                    {forgotMsg && (
                                                        <p style={{ fontSize: '11px', marginTop: '10px', color: '#008000', fontWeight: 'bold' }}>{forgotMsg}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="greenbox-bottom"></div>
                                        <div className="clear"></div>
                                    </div>

                                </div>
                            </div>
                            <div className="contentFooter">&nbsp;</div>
                        </div>

                    </div>
                    <div className="clear"></div>
                </div>

                <div id="ce"></div>
            </div>
        </div>
    );
}
