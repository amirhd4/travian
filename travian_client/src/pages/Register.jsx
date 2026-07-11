import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axiosConfig.js";
import { AlertModal } from "../components/Modal";

const TRIBES = [
    { value: "GAUL", label: "گل‌ها", image: "/assets/tribes/gaul.png" },
    { value: "TEUTON", label: "توتون‌ها", image: "/assets/tribes/teuton.png" },
    { value: "ROMAN", label: "رومی‌ها", image: "/assets/tribes/roman.png" },
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
        } catch (err) {
            console.error(err);
        } finally {
            setCaptchaLoading(false);
        }
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
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen game-bg flex items-center justify-center p-4">
            <AlertModal
                open={!!successMsg} tone="success" title="ثبت‌نام موفق" message={successMsg}
                onClose={() => navigate("/login")}
            />

            <div className="w-full max-w-xl panel overflow-hidden">
                <div className="bg-gradient-to-b from-ink-800 to-ink-900 px-8 py-6 text-center">
                    <h1 className="text-2xl font-extrabold text-parchment-50">ثبت‌نام در بازی</h1>
                    <p className="text-xs text-parchment-200 mt-1">دنیای خودت رو بساز</p>
                </div>

                <div className="p-7">
                    {error && (
                        <div className="bg-rose-50 border border-rose-300 text-rose-700 p-3 rounded-lg mb-4 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-6">
                        <fieldset className="border border-parchment-300 rounded-xl p-4">
                            <legend className="text-sm font-bold text-ink-700 px-2 bg-parchment-100 rounded">اطلاعات کاربری</legend>
                            <div className="space-y-3 mt-2">
                                <div>
                                    <label className="field-label">نام کاربری</label>
                                    <input type="text" name="username" value={formData.username} onChange={handleChange} required className="field" />
                                </div>
                                <div>
                                    <label className="field-label">پست الکترونیک</label>
                                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="field" />
                                </div>
                                <div>
                                    <label className="field-label">شماره موبایل</label>
                                    <input type="tel" name="phone_number" value={formData.phone_number} onChange={handleChange} required placeholder="09xxxxxxxxx" className="field" />
                                </div>
                                <div>
                                    <label className="field-label">رمز عبور</label>
                                    <input type="password" name="password" value={formData.password} onChange={handleChange} required minLength={8} className="field" />
                                </div>
                            </div>
                        </fieldset>

                        <fieldset className="border border-parchment-300 rounded-xl p-4">
                            <legend className="text-sm font-bold text-ink-700 px-2 bg-parchment-100 rounded">یک نژاد انتخاب کنید</legend>
                            <p className="text-xs text-ink-500 mt-2 mb-3">هر نژاد ویژگی‌های نظامی و اقتصادی متفاوتی دارد.</p>
                            <div className="grid grid-cols-3 gap-3">
                                {TRIBES.map((t) => (
                                    <label key={t.value} className="text-center cursor-pointer">
                                        <input type="radio" name="tribe" value={t.value} checked={formData.tribe === t.value} onChange={handleChange} className="hidden" />
                                        <div className={`p-2 border-2 rounded-xl transition ${formData.tribe === t.value ? "border-gold-500 bg-gold-50" : "border-parchment-300 bg-white"}`}>
                                            {/* پیشنهاد عکس: /assets/tribes/{gaul,teuton,roman}.png — نماد سپر/پرچم هر تمدن */}
                                            <img src={t.image} alt={t.label} className="w-full h-20 object-contain mx-auto mb-1" onError={(e) => { e.target.style.display = 'none'; }} />
                                            <span className="text-xs font-bold text-ink-700">{t.label}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className="border border-parchment-300 rounded-xl p-4">
                            <legend className="text-sm font-bold text-ink-700 px-2 bg-parchment-100 rounded">محل شروع</legend>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                                {STARTING_LOCATIONS.map((loc) => (
                                    <label key={loc.value} className="flex items-center gap-1.5 text-xs font-bold cursor-pointer bg-white border border-parchment-300 rounded-full px-3 py-1.5">
                                        <input type="radio" name="starting_location" value={loc.value} checked={formData.starting_location === loc.value} onChange={handleChange} />
                                        {loc.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <fieldset className="border border-parchment-300 rounded-xl p-4">
                            <legend className="text-sm font-bold text-ink-700 px-2 bg-parchment-100 rounded">اطلاعات بیشتر</legend>
                            <ul className="text-xs text-ink-600 space-y-1 mt-2 list-decimal list-inside">
                                <li>در صورت مشاهده‌ی هرگونه توهین یا الفاظ نامناسب، اکانت بازیکن خاطی بدون اخطار مسدود خواهد شد.</li>
                                <li>رمز اکانت خود را هرگز در اختیار هیچ‌کس قرار ندهید.</li>
                            </ul>
                            <label className="flex items-center gap-2 mt-3 text-xs font-bold cursor-pointer">
                                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} />
                                من قوانین را خوانده و قبول دارم.
                            </label>
                        </fieldset>

                        <fieldset className="border border-parchment-300 rounded-xl p-4">
                            <legend className="text-sm font-bold text-ink-700 px-2 bg-parchment-100 rounded">تایید امنیتی</legend>
                            <div className="flex items-center gap-3 mt-2">
                                {captchaLoading ? (
                                    <div className="w-40 h-[52px] bg-parchment-200 animate-pulse rounded-lg" />
                                ) : (
                                    <img src={captcha.image} alt="کپچا" className="rounded-lg border border-parchment-300" />
                                )}
                                <button type="button" onClick={fetchCaptcha} className="text-xs font-bold text-brand-600 hover:underline">🔄 تصویر جدید</button>
                            </div>
                            <input
                                type="text" required value={captchaAnswer} onChange={(e) => setCaptchaAnswer(e.target.value)}
                                placeholder="کد داخل تصویر را وارد کنید" className="field mt-2 text-center tracking-widest font-bold"
                            />
                        </fieldset>

                        <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                            {loading ? "در حال ثبت‌نام..." : "ثبت نام"}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-ink-600">
                        <span>قبلاً ثبت‌نام کرده‌اید؟ </span>
                        <Link to="/login" className="text-brand-600 font-bold hover:underline">ورود</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}