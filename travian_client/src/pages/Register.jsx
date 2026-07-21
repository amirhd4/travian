import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axiosConfig.js";
import { AlertModal } from "../components/Modal";

// ================= Data Constants ================= //
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

// ================= Reusable Components ================= //
const GreenBox = ({ title, children }) => (
    <div className="greenbox" style={{ width: '600px', marginBottom: '12px' }}>
        <div className="greenbox-top"></div>
        <div className="greenbox-content" style={{ padding: '12px' }}>
            <h4 style={{ marginBottom: '8px' }}>{title}</h4>
            {children}
        </div>
        <div className="greenbox-bottom"></div>
    </div>
);

// ================= Helper Functions ================= //
const getErrorMessage = (err) => {
    if (err.response?.status === 429) {
        return "تعداد درخواست‌های شما زیاد بوده؛ لطفا کمی صبر کنید.";
    }
    const data = err.response?.data;
    if (data) {
        const errorFields = ['username', 'email', 'password', 'captcha_answer', 'accept_terms', 'non_field_errors'];
        for (const field of errorFields) {
            if (data[field]?.[0]) return data[field][0];
        }
    }
    return "خطا در ارتباط با سرور. لطفا مجددا تلاش کنید.";
};

// ================= Main Component ================= //
export default function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: "", email: "", password: "",
        tribe: "ROMAN", starting_location: "RANDOM",
    });
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [captcha, setCaptcha] = useState({ token: "", image: "", answer: "" });
    const [status, setStatus] = useState({ error: "", loading: false, captchaLoading: true, successMsg: null });

    const fetchCaptcha = useCallback(async () => {
        setStatus(prev => ({ ...prev, captchaLoading: true }));
        setCaptcha(prev => ({ ...prev, answer: "" }));
        try {
            const { data } = await api.get("auth/captcha/");
            setCaptcha(prev => ({ ...prev, token: data.token, image: data.image }));
        } catch (err) {
            console.error("Error fetching captcha:", err);
        } finally {
            setStatus(prev => ({ ...prev, captchaLoading: false }));
        }
    }, []);

    useEffect(() => {
        fetchCaptcha();
    }, [fetchCaptcha]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setStatus(prev => ({ ...prev, error: "" }));

        if (!acceptTerms) {
            return setStatus(prev => ({ ...prev, error: "برای ثبت‌نام باید قوانین بازی را بپذیرید." }));
        }
        if (!captcha.answer) {
            return setStatus(prev => ({ ...prev, error: "لطفا کد امنیتی تصویر را وارد کنید." }));
        }

        setStatus(prev => ({ ...prev, loading: true }));
        try {
            const { data } = await api.post("auth/register/", {
                ...formData,
                phone_number: "0",
                accept_terms: acceptTerms,
                captcha_token: captcha.token,
                captcha_answer: captcha.answer,
            });
            setStatus(prev => ({ ...prev, successMsg: data.message || "ثبت‌نام شما با موفقیت انجام شد." }));
        } catch (err) {
            setStatus(prev => ({ ...prev, error: getErrorMessage(err) }));
            fetchCaptcha(); // Reload captcha on failure
        } finally {
            setStatus(prev => ({ ...prev, loading: false }));
        }
    };

    return (
        <div id="wrapper">
            <AlertModal
                open={!!status.successMsg}
                tone="success"
                title="ثبت‌نام موفق"
                message={status.successMsg}
                onClose={() => navigate("/login")}
            />

            <div className="bodyWrapper">
                <div id="header">
                    <div id="mtop">
                        <Link id="logo" to="/" title="Travian"></Link>
                        <div className="clear"></div>
                    </div>
                </div>

                <div id="mid">
                    <div className="contentTitle">&nbsp;</div>
                    <div className="contentContainer" style={{ padding: '20px' }}>
                        <div id="content">
                            <div className="outerLoginBox" style={{ width: '600px' }}>
                                <h2 className="titleInHeader">ثبت‌نام در بازی</h2>

                                {status.error && (
                                    <div style={{ padding: '8px', marginBottom: '12px', background: '#fcd1d1', border: '1px solid #DE0000', color: '#DE0000', fontWeight: 'bold', fontSize: '11px' }}>
                                        {status.error}
                                    </div>
                                )}

                                <form onSubmit={handleRegister}>

                                    {/* اطلاعات کاربری */}
                                    <GreenBox title="اطلاعات کاربری">
                                        <table className="transparent" style={{ width: '100%' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ width: '120px', fontWeight: 'bold', fontSize: '11px' }}>
                                                        <label htmlFor="username">نام کاربری:</label>
                                                    </td>
                                                    <td>
                                                        <input id="username" type="text" name="username" value={formData.username} onChange={handleChange} maxLength={15} className="text" dir="ltr" required style={{ width: '200px' }} />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 'bold', fontSize: '11px' }}>
                                                        <label htmlFor="email">پست الکترونیک:</label>
                                                    </td>
                                                    <td>
                                                        <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} maxLength={40} className="text" dir="ltr" required style={{ width: '200px' }} />
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style={{ fontWeight: 'bold', fontSize: '11px' }}>
                                                        <label htmlFor="password">رمز عبور:</label>
                                                    </td>
                                                    <td>
                                                        <input id="password" type="password" name="password" value={formData.password} onChange={handleChange} maxLength={20} minLength={8} className="text" dir="ltr" required style={{ width: '200px' }} />
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </GreenBox>

                                    {/* انتخاب نژاد */}
                                    <GreenBox title="انتخاب نژاد">
                                        <div className="tribeSelect">
                                            {TRIBES.map((t) => (
                                                <label key={t.value} className="tribe" style={{
                                                    border: formData.tribe === t.value ? '2px solid #498843' : '2px solid #C9C9C9',
                                                    padding: '8px',
                                                    borderRadius: '4px',
                                                    background: formData.tribe === t.value ? '#E5EECC' : '#FFF',
                                                    cursor: 'pointer'
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
                                    </GreenBox>

                                    {/* محل شروع */}
                                    <GreenBox title="محل شروع">
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
                                    </GreenBox>

                                    {/* قوانین */}
                                    <div style={{ marginBottom: '12px', padding: '8px', background: '#F5F5F5', border: '1px dashed #C0C0C0', fontSize: '11px' }}>
                                        <ul className="important" style={{ paddingInlineStart: '20px', margin: '0 0 8px 0' }}>
                                            <li>در صورت مشاهده‌ی هرگونه توهین یا الفاظ نامناسب، اکانت بازیکن خاطی مسدود خواهد شد.</li>
                                            <li>رمز اکانت خود را هرگز در اختیار هیچ‌کس قرار ندهید.</li>
                                        </ul>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                                            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                                            من قوانین را خوانده‌ام و آن‌ها را می‌پذیرم.
                                        </label>
                                    </div>

                                    {/* کد امنیتی */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label htmlFor="captchaInput" style={{ fontWeight: 'bold', fontSize: '11px' }}>کد امنیتی:</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <div style={{ width: '120px', height: '40px', background: '#F5F5F5', border: '1px solid #CCC', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                                {status.captchaLoading ? (
                                                    <span style={{ color: '#777', fontSize: '10px' }}>...</span>
                                                ) : (
                                                    <img src={captcha.image} alt="کپچا" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                )}
                                            </div>
                                            <button type="button" onClick={fetchCaptcha} disabled={status.captchaLoading} className="refreshCaptcha" style={{ fontSize: '11px', cursor: 'pointer' }}>
                                                تغییر تصویر
                                            </button>
                                            <input
                                                id="captchaInput"
                                                type="text"
                                                required
                                                value={captcha.answer}
                                                onChange={(e) => setCaptcha(prev => ({ ...prev, answer: e.target.value }))}
                                                placeholder="کد را وارد کنید"
                                                className="text"
                                                dir="ltr"
                                                style={{ width: '100px' }}
                                                autoComplete="off"
                                            />
                                        </div>
                                    </div>

                                    <button type="submit" disabled={status.loading || !acceptTerms || !captcha.answer} className="btn-primary" style={{ padding: '6px 30px', cursor: 'pointer' }}>
                                        {status.loading ? "در حال پردازش..." : "تکمیل ثبت‌نام"}
                                    </button>
                                </form>

                                <div style={{ marginTop: '15px', fontSize: '11px' }}>
                                    <Link to="/login" style={{ color: '#99C01A' }}>قبلا ثبت‌نام کرده‌اید؟ وارد شوید</Link>
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