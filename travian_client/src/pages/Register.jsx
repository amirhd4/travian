import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
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
        <div
            dir="rtl"
            className="min-h-screen text-slate-800 font-sans flex flex-col"
            style={{
                backgroundImage: "url('/assets/bgs/login-rtl.jpg')",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                backgroundAttachment: 'fixed'
            }}
        >
            <AlertModal
                open={!!successMsg}
                tone="success"
                title="ثبت‌نام موفق"
                message={successMsg}
                onClose={() => navigate("/login")}
            />

            {/* نوار ناوبری */}
            <nav className="bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <Link to="/" className="text-2xl font-bold text-emerald-600 tracking-tight">
                                تراوین <span className="text-slate-700">کلون</span>
                            </Link>
                        </div>
                        <div className="hidden sm:flex space-x-6 space-x-reverse">
                            <Link to="/" className="text-slate-500 hover:text-emerald-600 font-medium transition-colors">صفحه اصلی</Link>
                            <Link to="/login" className="text-slate-500 hover:text-emerald-600 font-medium transition-colors">ورود</Link>
                            <Link to="/register" className="text-emerald-600 font-bold border-b-2 border-emerald-600">ثبت‌نام</Link>
                            <Link to="#" className="text-slate-500 hover:text-emerald-600 font-medium transition-colors">پشتیبانی</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* محتوای اصلی */}
            <main className="flex-1 flex justify-center items-start p-4 sm:p-8 overflow-y-auto">
                <div className="w-full max-w-3xl bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-100 mt-4 mb-12">

                    {/* هدر فرم */}
                    <div className="bg-slate-800 p-6 sm:px-10 text-center">
                        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">ثبت‌نام در بازی</h1>
                        <p className="text-slate-400 text-sm">برای ساخت امپراطوری خود، فرم زیر را تکمیل کنید.</p>
                    </div>

                    <div className="p-6 sm:p-10">
                        {/* نمایش ارور */}
                        {error && (
                            <div className="mb-6 bg-red-50 border-r-4 border-red-500 p-4 rounded-l text-red-700 text-sm font-medium animate-pulse">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleRegister} className="space-y-8">

                            {/* بخش 1: اطلاعات کاربری */}
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">۱</span>
                                    اطلاعات کاربری
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">نام کاربری</label>
                                        <input
                                            type="text"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleChange}
                                            maxLength={15}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-left"
                                            dir="ltr"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">پست الکترونیک</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            maxLength={40}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-left"
                                            dir="ltr"
                                            required
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-slate-700 mb-1">رمز عبور</label>
                                        <input
                                            type="password"
                                            name="password"
                                            value={formData.password}
                                            onChange={handleChange}
                                            maxLength={20}
                                            minLength={8}
                                            className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-left font-sans"
                                            dir="ltr"
                                            required
                                        />
                                    </div>
                                </div>
                            </section>

                            <hr className="border-slate-200" />

                            {/* بخش 2: انتخاب نژاد */}
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">۲</span>
                                    انتخاب نژاد
                                </h3>
                                <p className="text-sm text-slate-500 mb-4">
                                    اگر تازه‌کار هستید، پیشنهاد ما انتخاب نژاد <strong className="text-emerald-600">گل‌ها</strong> است!
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {TRIBES.map((t) => (
                                        <label
                                            key={t.value}
                                            className={`relative flex flex-col items-center p-4 rounded-xl cursor-pointer border-2 transition-all duration-200 hover:shadow-md ${
                                                formData.tribe === t.value 
                                                    ? 'border-emerald-500 bg-emerald-50/50' 
                                                    : 'border-slate-200 hover:border-emerald-300 bg-white'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="tribe"
                                                value={t.value}
                                                checked={formData.tribe === t.value}
                                                onChange={handleChange}
                                                className="absolute opacity-0 w-0 h-0"
                                            />
                                            <div className="h-32 flex items-center justify-center mb-3">
                                                <img
                                                    src={t.image}
                                                    alt={t.label}
                                                    title={t.label}
                                                    className="max-h-full drop-shadow-md"
                                                    onError={(e) => { e.target.src = t.fallback; }}
                                                />
                                            </div>
                                            <div className="text-center">
                                                <span className={`block font-bold text-lg mb-1 ${formData.tribe === t.value ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                    {t.label}
                                                </span>
                                                <span className="text-xs text-slate-500">{t.desc}</span>
                                            </div>

                                            {/* تیک سبز هنگام انتخاب */}
                                            {formData.tribe === t.value && (
                                                <div className="absolute top-3 right-3 bg-emerald-500 text-white rounded-full p-1 shadow-sm">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                </div>
                                            )}
                                        </label>
                                    ))}
                                </div>
                            </section>

                            <hr className="border-slate-200" />

                            {/* بخش 3: محل شروع */}
                            <section>
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-sm">۳</span>
                                    محل شروع
                                </h3>
                                <div className="flex flex-wrap gap-3">
                                    {STARTING_LOCATIONS.map((loc) => (
                                        <label
                                            key={loc.value}
                                            className={`cursor-pointer px-4 py-2 rounded-full border text-sm font-semibold transition-colors ${
                                                formData.starting_location === loc.value
                                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="starting_location"
                                                value={loc.value}
                                                checked={formData.starting_location === loc.value}
                                                onChange={handleChange}
                                                className="hidden"
                                            />
                                            {loc.label}
                                        </label>
                                    ))}
                                </div>
                            </section>

                            <hr className="border-slate-200" />

                            {/* بخش 4: قوانین و کپچا */}
                            <section className="space-y-6">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm text-slate-600">
                                    <ul className="space-y-2 list-disc list-inside">
                                        <li>در صورت مشاهده‌ی هرگونه توهین یا الفاظ نامناسب، اکانت بازیکن خاطی مسدود خواهد شد.</li>
                                        <li>رمز اکانت خود را هرگز در اختیار هیچ‌کس قرار ندهید.</li>
                                    </ul>
                                </div>

                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={acceptTerms}
                                        onChange={(e) => setAcceptTerms(e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-slate-700 font-medium group-hover:text-emerald-700 transition-colors">
                                        من قوانین را خوانده‌ام و آن‌ها را می‌پذیرم.
                                    </span>
                                </label>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">کد امنیتی تصویر</label>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-32 h-14 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
                                                {captchaLoading ? (
                                                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <img src={captcha.image} alt="کپچا" className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={fetchCaptcha}
                                                disabled={captchaLoading}
                                                className="p-3 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
                                                title="تصویر جدید"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            required
                                            value={captchaAnswer}
                                            onChange={(e) => setCaptchaAnswer(e.target.value)}
                                            placeholder="کد را وارد کنید"
                                            className="w-full sm:w-48 px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-center tracking-widest font-bold"
                                            dir="ltr"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* دکمه ثبت نام */}
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loading || !acceptTerms || !captchaAnswer}
                                    className="w-full sm:w-auto sm:min-w-[200px] mx-auto block bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-bold py-3 px-8 rounded-xl shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                                >
                                    {loading ? "در حال پردازش..." : "تکمیل ثبت‌نام"}
                                </button>
                            </div>

                            <p className="text-center text-sm text-slate-500 mt-6">
                                قبلاً ثبت‌نام کرده‌اید؟ <Link to="/login" className="text-emerald-600 font-bold hover:underline">وارد شوید</Link>
                            </p>

                        </form>
                    </div>
                </div>
            </main>
        </div>
    );
}