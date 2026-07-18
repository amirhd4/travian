import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig.js";
import { AlertModal } from "../components/Modal";

const TRIBES = [
    { value: "ROMAN", label: "رومی‌ها", image: "/assets/tribes/roman-splash.gif", fallback: "/assets/tribes/roman.png", desc: "متعادل و مناسب برای تازه‌کارها" },
    { value: "TEUTON", label: "توتون‌ها", image: "/assets/tribes/teuton-splash.gif", fallback: "/assets/tribes/teuton.png", desc: "هجومی و غارتگر" },
    { value: "GAUL", label: "گل‌ها", image: "/assets/tribes/gaul-splash.gif", fallback: "/assets/tribes/gaul.png", desc: "مدافعین سرسخت و سریع" },
];

const STARTING_LOCATIONS = [
    { value: "RANDOM", label: "انتخاب تصادفی" },
    { value: "NW", label: "شمال غرب" },
    { value: "NE", label: "شمال شرق" },
    { value: "SW", label: "جنوب غرب" },
    { value: "SE", label: "جنوب شرق" },
];

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "", email: "", password: "",
        tribe: "ROMAN", starting_location: "RANDOM",
    });
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [captchaAnswer, setCaptchaAnswer] = useState("");
    const [captcha, setCaptcha] = useState({ token: "", image: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [captchaLoading, setCaptchaLoading] = useState(true);
    const [successMsg, setSuccessMsg] = useState(null);

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

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");

        if (!acceptTerms) {
            setError("برای ثبت‌نام باید قوانین بازی را بپذیرید.");
            return;
        }
        if (!captchaAnswer) {
            setError("لطفا کد امنیتی تصویر را وارد کنید.");
            return;
        }

        setLoading(true);
        try {
            const { data } = await api.post("auth/register/", {
                ...formData,
                phone_number: "0",
                accept_terms: acceptTerms,
                captcha_token: captcha.token,
                captcha_answer: captchaAnswer,
            });
            setSuccessMsg(data.message || "ثبت‌نام شما با موفقیت انجام شد.");
        } catch (err) {
            if (err.response?.status === 429) {
                setError("تعداد درخواست‌های شما زیاد بوده؛ لطفا کمی صبر کنید.");
            } else {
                setError(
                    err.response?.data?.username?.[0] ||
                    err.response?.data?.email?.[0] ||
                    err.response?.data?.password?.[0] ||
                    err.response?.data?.captcha_answer?.[0] ||
                    err.response?.data?.accept_terms?.[0] ||
                    err.response?.data?.non_field_errors?.[0] ||
                    "خطا در ارتباط با سرور. لطفا مجددا تلاش کنید."
                );
            }
            fetchCaptcha();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div id="wrapper">
            <AlertModal
                open={!!successMsg}
                tone="success"
                title="ثبت‌نام موفق"
                message={successMsg}
                onClose={() => navigate("/login")}
            />

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
                            <div className="outerLoginBox" style={{ width: '600px' }}>
                                <h2 className="titleInHeader">ثبت‌نام در بازی</h2>

                                {error && (
                                    <div style={{ padding: '8px', marginBottom: '12px', background: '#fcd1d1', border: '1px solid #DE0000', color: '#DE0000', fontWeight: 'bold', fontSize: '11px' }}>
                                        {error}
                                    </div>
                                )}

                                <form onSubmit={handleRegister}>
                                    <div className="greenbox" style={{ width: '600px', marginBottom: '12px' }}>
                                        <div className="greenbox-top"></div>
                                        <div className="greenbox-content" style={{ padding: '12px' }}>
                                            <h4 style={{ marginBottom: '8px' }}>اطلاعات کاربری</h4>
                                            <table className="transparent" style={{ width: '100%' }}>
                                                <tbody>
                                                    <tr>
                                                        <td style={{ width: '120px', fontWeight: 'bold', fontSize: '11px' }}>نام کاربری:</td>
                                                        <td><input type="text" name="username" value={formData.username} onChange={handleChange} maxLength={15} className="text" dir="ltr" required style={{ width: '200px' }} /></td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', fontSize: '11px' }}>پست الکترونیک:</td>
                                                        <td><input type="email" name="email" value={formData.email} onChange={handleChange} maxLength={40} className="text" dir="ltr" required style={{ width: '200px' }} /></td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ fontWeight: 'bold', fontSize: '11px' }}>رمز عبور:</td>
                                                        <td><input type="password" name="password" value={formData.password} onChange={handleChange} maxLength={20} minLength={8} className="text" dir="ltr" required style={{ width: '200px' }} /></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="greenbox-bottom"></div>
                                    </div>

                                    <div className="greenbox" style={{ width: '600px', marginBottom: '12px' }}>
                                        <div className="greenbox-top"></div>
                                        <div className="greenbox-content" style={{ padding: '12px' }}>
                                            <h4 style={{ marginBottom: '8px' }}>انتخاب نژاد</h4>
                                            <div className="tribeSelect">
                                                {TRIBES.map((t) => (
                                                    <label key={t.value} className="tribe" style={{
                                                        border: formData.tribe === t.value ? '2px solid #498843' : '2px solid #C9C9C9',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        background: formData.tribe === t.value ? '#E5EECC' : '#FFF',
                                                    }}>
                                                        <input
                                                            type="radio"
                                                            name="tribe"
                                                            value={t.value}
                                                            checked={formData.tribe === t.value}
                                                            onChange={handleChange}
                                                            style={{ display: 'none' }}
                                                        />
                                                        <div className="selection">
                                                            <img src={t.image} alt={t.label} className="tribeImage"
                                                                onError={(e) => { e.target.src = t.fallback; }} />
                                                        </div>
                                                        <p style={{ fontWeight: 'bold', fontSize: '12px' }}>{t.label}</p>
                                                        <p style={{ fontSize: '10px', color: '#777' }}>{t.desc}</p>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="greenbox-bottom"></div>
                                    </div>

                                    <div className="greenbox" style={{ width: '600px', marginBottom: '12px' }}>
                                        <div className="greenbox-top"></div>
                                        <div className="greenbox-content" style={{ padding: '12px' }}>
                                            <h4 style={{ marginBottom: '8px' }}>محل شروع</h4>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                {STARTING_LOCATIONS.map((loc) => (
                                                    <label key={loc.value} style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        padding: '4px 10px', fontSize: '11px', fontWeight: 'bold',
                                                        border: '1px solid #C9C9C9', borderRadius: '4px', cursor: 'pointer',
                                                        background: formData.starting_location === loc.value ? '#498843' : '#FFF',
                                                        color: formData.starting_location === loc.value ? '#FFF' : '#252525',
                                                    }}>
                                                        <input type="radio" name="starting_location" value={loc.value}
                                                            checked={formData.starting_location === loc.value}
                                                            onChange={handleChange} style={{ display: 'none' }} />
                                                        {loc.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="greenbox-bottom"></div>
                                    </div>

                                    <div style={{ marginBottom: '12px', padding: '8px', background: '#F5F5F5', border: '1px dashed #C0C0C0', fontSize: '11px' }}>
                                        <ul className="important">
                                            <li>در صورت مشاهده‌ی هرگونه توهین یا الفاظ نامناسب، اکانت بازیکن خاطی مسدود خواهد شد.</li>
                                            <li>رمز اکانت خود را هرگز در اختیار هیچ‌کس قرار ندهید.</li>
                                        </ul>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                                            من قوانین را خوانده‌ام و آن‌ها را می‌پذیرم.
                                        </label>
                                    </div>

                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{ fontWeight: 'bold', fontSize: '11px' }}>کد امنیتی:</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
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
                                            <input
                                                type="text"
                                                required
                                                value={captchaAnswer}
                                                onChange={(e) => setCaptchaAnswer(e.target.value)}
                                                placeholder="کد را وارد کنید"
                                                className="text"
                                                dir="ltr"
                                                style={{ width: '100px' }}
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={loading || !acceptTerms || !captchaAnswer} className="btn-primary" style={{ padding: '6px 30px' }}>
                                        {loading ? "در حال پردازش..." : "تکمیل ثبت‌نام"}
                                    </button>
                                </form>

                                <div style={{ marginTop: '15px', fontSize: '11px' }}>
                                    <a href="/login" style={{ color: '#99C01A' }}>قبلا ثبت‌نام کرده‌اید؟ وارد شوید</a>
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
