import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axiosConfig.js";
import { AlertModal } from "../components/Modal";

const TRIBES = [
    { value: "GAUL", label: "گل‌ها", image: "/assets/tribes/gaul-splash.gif", fallback: "/assets/tribes/gaul.png" },
    { value: "TEUTON", label: "توتون‌ها", image: "/assets/tribes/teuton-splash.gif", fallback: "/assets/tribes/teuton.png" },
    { value: "ROMAN", label: "رومی‌ها", image: "/assets/tribes/roman-splash.gif", fallback: "/assets/tribes/roman.png" },
];

const STARTING_LOCATIONS = [
    { value: "RANDOM", label: "تصادفی" },
    { value: "NW", label: "شمال غرب" },
    { value: "NE", label: "شمال شرق" },
    { value: "SW", label: "جنوب غرب" },
    { value: "SE", label: "جنوب شرق" },
];

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: "", email: "", phone_number: "", password: "",
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
        } catch (err) { console.error(err); }
        finally { setCaptchaLoading(false); }
    }, []);

    useEffect(() => { fetchCaptcha(); }, [fetchCaptcha]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        if (!acceptTerms) { setError("برای ثبت‌نام باید قوانین بازی را بپذیرید."); return; }
        if (!captchaAnswer) { setError("لطفا کد امنیتی تصویر را وارد کنید."); return; }
        setLoading(true);
        try {
            const { data } = await api.post("auth/register/", {
                ...formData, accept_terms: acceptTerms,
                captcha_token: captcha.token, captcha_answer: captchaAnswer,
            });
            setSuccessMsg(data.message || "ثبت‌نام موفق");
        } catch (err) {
            if (err.response?.status === 429) {
                setError("تعداد درخواست‌های شما زیاد بوده؛ لطفا کمی صبر کنید.");
            } else {
                setError(
                    err.response?.data?.username?.[0] || err.response?.data?.email?.[0] ||
                    err.response?.data?.phone_number?.[0] || err.response?.data?.password?.[0] ||
                    err.response?.data?.captcha_answer?.[0] || err.response?.data?.accept_terms?.[0] ||
                    err.response?.data?.non_field_errors?.[0] || "خطا در ثبت‌نام"
                );
            }
            fetchCaptcha();
        } finally { setLoading(false); }
    };

    return (
        <div style={{ minHeight: '100vh', background: '#A1BB79', direction: 'rtl' }}>
            <AlertModal open={!!successMsg} tone="success" title="ثبت‌نام موفق" message={successMsg} onClose={() => navigate("/login")} />

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
                            <li><a href="/login">ورود</a></li>
                            <li className="active"><a href="/register">ثبت‌نام</a></li>
                            <li><a href="#">انجمن</a></li>
                            <li><a href="#">پشتیبانی</a></li>
                        </ul>
                    </div>
                    <div className="clear" />

                    {/* Content area */}
                    <div id="contentOuterContainer">
                        <div className="contentTitle">&nbsp;</div>
                        <div className="contentContainer">
                            <div id="content" style={{ padding: '23px 23px 26px 23px' }}>
                                <h1 style={{ fontSize: '18px', marginBottom: '8px' }}>ثبت‌نام در بازی</h1>

                                {error && (
                                    <div style={{ background: '#fcd1d1', border: '1px solid #DE0000', color: '#DE0000', padding: '10px', marginBottom: '15px', fontSize: '12px', fontWeight: 'bold' }}>{error}</div>
                                )}

                                <form onSubmit={handleRegister}>
                                    <table style={{ borderCollapse: 'separate', width: '500px', marginBottom: '15px' }}>
                                        <tbody>
                                            {[
                                                { name: 'username', label: 'نام کاربری', type: 'text', required: true },
                                                { name: 'email', label: 'پست الکترونیک', type: 'email', required: true },
                                                { name: 'phone_number', label: 'شماره موبایل', type: 'tel', required: true, placeholder: '09xxxxxxxxx' },
                                                { name: 'password', label: 'رمز عبور', type: 'password', required: true, minLength: 8 },
                                            ].map((field) => (
                                                <tr key={field.name}>
                                                    <td style={{ width: '115px', fontWeight: 'bold', fontSize: '11px', paddingBottom: '10px', verticalAlign: 'top', paddingTop: '3px' }}>{field.label}</td>
                                                    <td style={{ paddingBottom: '10px' }}>
                                                        <input type={field.type} name={field.name} value={formData[field.name]} onChange={handleChange} required={field.required} minLength={field.minLength} placeholder={field.placeholder} className="text" style={{ width: '250px' }} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Tribe selection */}
                                    <h4 className="round">یک نژاد انتخاب کنید</h4>
                                    <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                                        {TRIBES.map((t) => (
                                            <label key={t.value} style={{ textAlign: 'center', cursor: 'pointer', flex: 1 }}>
                                                <input type="radio" name="tribe" value={t.value} checked={formData.tribe === t.value} onChange={handleChange} style={{ display: 'none' }} />
                                                <div style={{ padding: '8px', border: `2px solid ${formData.tribe === t.value ? '#F88C1F' : '#C9C9C9'}`, background: formData.tribe === t.value ? '#ffe4b5' : '#FFF' }}>
                                                    <img src={t.image} alt={t.label} style={{ width: '100%', height: '80px', objectFit: 'contain' }} onError={(e) => { e.target.src = t.fallback; }} />
                                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#252525', marginTop: '4px' }}>{t.label}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    {/* Starting location */}
                                    <h4 className="round">محل شروع</h4>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                        {STARTING_LOCATIONS.map((loc) => (
                                            <label key={loc.value} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', background: '#FFF', border: '1px solid #CCC', borderRadius: '10px', padding: '4px 12px' }}>
                                                <input type="radio" name="starting_location" value={loc.value} checked={formData.starting_location === loc.value} onChange={handleChange} />
                                                {loc.label}
                                            </label>
                                        ))}
                                    </div>

                                    {/* Terms */}
                                    <h4 className="round">قوانین</h4>
                                    <div style={{ marginBottom: '20px', padding: '12px', background: '#F5F5F5', border: '1px solid #CCC' }}>
                                        <ul style={{ fontSize: '11px', color: '#252525', margin: '0 0 10px 0', paddingRight: '16px' }}>
                                            <li style={{ marginBottom: '4px' }}>در صورت مشاهده‌ی هرگونه توهین یا الفاظ نامناسب، اکانت بازیکن خاطی بدون اخطار مسدود خواهد شد.</li>
                                            <li>رمز اکانت خود را هرگز در اختیار هیچ‌کس قرار ندهید.</li>
                                        </ul>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                                            من قوانین را خوانده و قبول دارم.
                                        </label>
                                    </div>

                                    {/* Captcha */}
                                    <h4 className="round">تایید امنیتی</h4>
                                    <div style={{ marginBottom: '20px', padding: '12px', background: '#F5F5F5', border: '1px solid #CCC' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                            {captchaLoading ? (
                                                <div style={{ width: '128px', height: '52px', background: '#E5E5E5' }} />
                                            ) : (
                                                <img src={captcha.image} alt="کپچا" style={{ border: '1px solid #CCC' }} />
                                            )}
                                            <button type="button" onClick={fetchCaptcha} style={{ background: 'none', border: 'none', color: '#99C01A', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 تصویر جدید</button>
                                        </div>
                                        <input type="text" required value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)} placeholder="کد داخل تصویر را وارد کنید" className="text" style={{ width: '250px', textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }} />
                                    </div>

                                    <button type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '8px 20px' }}>
                                        {loading ? "در حال ثبت‌نام..." : "ثبت نام"}
                                    </button>
                                </form>

                                <div style={{ marginTop: '16px', fontSize: '12px' }}>
                                    <span>قبلاً ثبت‌نام کرده‌اید؟ </span>
                                    <Link to="/login">ورود</Link>
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
