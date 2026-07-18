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
    const [forgotMsg, setForgotMsg] = useState({ type: "", text: "" });

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

    useEffect(() => {
        fetchCaptcha();
    }, [fetchCaptcha]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const { data } = await api.post("auth/login/", {
                username: login,
                password,
                captcha_token: captcha.token,
                captcha_answer: captchaAnswer,
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
        setForgotMsg({ type: "", text: "" });
        try {
            await api.post("auth/forgot-password/", { email: forgotEmail });
            setForgotMsg({ type: "success", text: "ایمیل بازیابی رمز عبور برای شما ارسال شد." });
        } catch (err) {
            setForgotMsg({
                type: "error",
                text: err.response?.data?.error || "خطا در ارسال ایمیل"
            });
        }
    };

    return (
        <div id="wrapper">
            <div className="bodyWrapper">
                <div id="header">
                    <div id="mtop">
                        <a id="logo" href="/" title="Travian"></a>
                        <div className="clear"></div>
                    </div>
                </div>
                <div id="mid">
                    <div className="contentTitle">&nbsp;</div>
                    <div className="contentContainer" style={{ padding: '20px' }}>
                        <div id="content">
                            <div className="outerLoginBox">
                                <h2 className="titleInHeader">ورود به بازی</h2>

                                {error && (
                                    <div style={{ padding: '8px', marginBottom: '12px', background: '#fcd1d1', border: '1px solid #DE0000', color: '#DE0000', fontWeight: 'bold', fontSize: '11px' }}>
                                        {error}
                                    </div>
                                )}

                                <div className="innerLoginBox">
                                    <form onSubmit={handleLogin}>
                                        <table className="loginTable">
                                            <tbody>
                                                <tr className="top">
                                                    <td className="accountNameOrEmailAddress">نام کاربری</td>
                                                    <td>
                                                        <input
                                                            type="text"
                                                            value={login}
                                                            onChange={(e) => setLogin(e.target.value)}
                                                            className="text"
                                                            dir="ltr"
                                                            required
                                                        />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>رمز عبور</td>
                                                    <td>
                                                        <input
                                                            type="password"
                                                            maxLength={20}
                                                            value={password}
                                                            onChange={(e) => setPassword(e.target.value)}
                                                            className="text"
                                                            dir="ltr"
                                                            required
                                                        />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td>کد امنیتی</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '120px', height: '40px', background: '#F5F5F5', border: '1px solid #CCC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                {captchaLoading ? (
                                                                    <span style={{ color: '#777', fontSize: '10px' }}>...</span>
                                                                ) : (
                                                                    <img src={captcha.image} alt="کپچا" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                                                )}
                                                            </div>
                                                            <button type="button" onClick={fetchCaptcha} disabled={captchaLoading} className="refreshCaptcha">
                                                                تغییر تصویر
                                                            </button>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            required
                                                            value={captchaAnswer}
                                                            onChange={(e) => setCaptchaAnswer(e.target.value)}
                                                            placeholder="کد داخل تصویر را وارد کنید"
                                                            className="text"
                                                            dir="ltr"
                                                            style={{ marginTop: '4px' }}
                                                        />
                                                    </td>
                                                </tr>
                                                <tr className="btm">
                                                    <td></td>
                                                    <td>
                                                        <button type="submit" disabled={loading || !login || !password || !captchaAnswer} className="btn-primary" style={{ marginTop: '4px' }}>
                                                            {loading ? "در حال ورود..." : "ورود"}
                                                        </button>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </form>
                                </div>

                                <div style={{ marginTop: '10px' }}>
                                    <button onClick={() => setShowForgot(!showForgot)} className="refreshCaptcha">
                                        {showForgot ? 'بازگشت' : 'رمز عبور خود را فراموش کرده‌اید؟'}
                                    </button>

                                    {showForgot && (
                                        <form onSubmit={handleForgotPassword} style={{ marginTop: '10px', padding: '8px', background: '#F5F5F5', border: '1px dashed #C0C0C0' }}>
                                            <p style={{ fontSize: '11px', marginBottom: '8px' }}>
                                                ایمیل متصل به حساب کاربری خود را وارد کنید:
                                            </p>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                                <input
                                                    type="email"
                                                    required
                                                    value={forgotEmail}
                                                    onChange={(e) => setForgotEmail(e.target.value)}
                                                    placeholder="ایمیل شما"
                                                    className="text"
                                                    dir="ltr"
                                                    style={{ flex: 1 }}
                                                />
                                                <button type="submit" className="btn-primary">ارسال</button>
                                            </div>
                                            {forgotMsg.text && (
                                                <p style={{ marginTop: '8px', fontSize: '11px', fontWeight: 'bold', color: forgotMsg.type === 'success' ? '#228B22' : '#DE0000' }}>
                                                    {forgotMsg.text}
                                                </p>
                                            )}
                                        </form>
                                    )}
                                </div>

                                <div style={{ marginTop: '15px', fontSize: '11px' }}>
                                    <a href="/register" style={{ color: '#99C01A' }}>ثبت‌نام در بازی</a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="contentFooter">&nbsp;</div>
                </div>
            </div>
        </div>
    );
}
