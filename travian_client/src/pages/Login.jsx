import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
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
    const [forgotMsg, setForgotMsg] = useState({ type: "", text: "" }); // type: 'error' | 'success'

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
        <div dir="rtl" className="min-h-screen text-slate-800 font-sans flex flex-col" style={{ backgroundImage: "url('/assets/bgs/login-rtl.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}>
            {/* نوار ناوبری (Navbar) */}
            <nav className="bg-white shadow-sm border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex-shrink-0 flex items-center">
                            <Link to="/" className="text-2xl font-bold text-emerald-600 tracking-tight">
                                تراوین <span className="text-slate-700">کلون</span>
                            </Link>
                        </div>
                        <div className="hidden sm:flex space-x-6 space-x-reverse">
                            <Link to="/" className="text-slate-500 hover:text-emerald-600 font-medium transition-colors">صفحه اصلی</Link>
                            <Link to="/login" className="text-emerald-600 font-bold border-b-2 border-emerald-600">ورود</Link>
                            <Link to="/register" className="text-slate-500 hover:text-emerald-600 font-medium transition-colors">ثبت‌نام</Link>
                            <Link to="#" className="text-slate-500 hover:text-emerald-600 font-medium transition-colors">راهنمای بازی</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* محتوای اصلی */}
            <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8">
                <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">

                    {/* هدر فرم */}
                    <div className="bg-slate-800 p-6 text-center">
                        <h1 className="text-2xl font-bold text-white mb-1">ورود به حساب کاربری</h1>
                        <p className="text-slate-400 text-sm">برای ورود به دهکده خود، اطلاعات زیر را وارد کنید.</p>
                    </div>

                    <div className="p-6 sm:p-8">
                        {/* نمایش ارور */}
                        {error && (
                            <div className="mb-6 bg-red-50 border-r-4 border-red-500 p-4 rounded-l text-red-700 text-sm font-medium animate-pulse">
                                {error}
                            </div>
                        )}

                        {/* فرم ورود */}
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">نام کاربری</label>
                                <input
                                    type="text"
                                    value={login}
                                    onChange={(e) => setLogin(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-left"
                                    dir="ltr"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">رمز عبور</label>
                                <input
                                    type="password"
                                    maxLength={20}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-left font-sans"
                                    dir="ltr"
                                    required
                                />
                            </div>

                            {/* بخش کپچا */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">کد امنیتی</label>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="flex-1 h-14 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden border border-slate-200">
                                        {captchaLoading ? (
                                            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <img src={captcha.image} alt="کپچا" className="max-w-full h-auto object-contain" />
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={fetchCaptcha}
                                        disabled={captchaLoading}
                                        className="px-4 py-3 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-400"
                                    >
                                        تغییر تصویر
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={captchaAnswer}
                                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                                    placeholder="کد داخل تصویر را وارد کنید"
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-center tracking-widest font-bold"
                                    dir="ltr"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !login || !password || !captchaAnswer}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg shadow-md shadow-emerald-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                            >
                                {loading ? "در حال ورود به سیستم..." : "ورود به بازی"}
                            </button>
                        </form>

                        {/* خط جداکننده */}
                        <div className="mt-8 mb-6 border-t border-slate-200 relative">
                            <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-3 text-xs text-slate-400">یا</span>
                        </div>

                        {/* بخش فراموشی رمز */}
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <button
                                onClick={() => setShowForgot(!showForgot)}
                                className="w-full flex justify-between items-center text-sm font-semibold text-slate-600 hover:text-emerald-600 transition-colors focus:outline-none"
                            >
                                رمز عبور خود را فراموش کرده‌اید؟
                                <svg className={`w-5 h-5 transform transition-transform duration-300 ${showForgot ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>

                            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showForgot ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0'}`}>
                                <form onSubmit={handleForgotPassword} className="space-y-3">
                                    <p className="text-xs text-slate-500">
                                        ایمیل متصل به حساب کاربری خود را وارد کنید تا لینک بازیابی ارسال شود.
                                    </p>
                                    <div className="flex gap-2">
                                        <input
                                            type="email"
                                            required
                                            value={forgotEmail}
                                            onChange={(e) => setForgotEmail(e.target.value)}
                                            placeholder="ایمیل شما"
                                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-left"
                                            dir="ltr"
                                        />
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium rounded-lg transition-colors"
                                        >
                                            ارسال
                                        </button>
                                    </div>

                                    {/* پیام وضعیت فرم فراموشی */}
                                    {forgotMsg.text && (
                                        <div className={`p-3 rounded-lg text-xs font-semibold ${forgotMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {forgotMsg.text}
                                        </div>
                                    )}
                                </form>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
}