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
            console.error("خطا در دریافت کپچا", err);
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

    return (
        <div className="min-h-screen game-bg flex items-center justify-center p-4">
            {/* دکوری پس‌زمینه - جای عکس تپه/درخت رو اینجا میتونی بذاری */}
            <div className="w-full max-w-md">
                <div className="panel overflow-hidden">
                    <div className="bg-gradient-to-b from-ink-800 to-ink-900 px-8 py-7 text-center">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gold-500/15 border border-gold-500/40 flex items-center justify-center text-3xl">
                            🏰
                        </div>
                        <h1 className="text-2xl font-extrabold text-parchment-50">ورود به بازی</h1>
                        <p className="text-xs text-parchment-400 mt-1">دنیای تراوین منتظر شماست</p>
                    </div>

                    <div className="p-7">
                        {error && (
                            <div className="bg-rose-50 border border-rose-300 text-rose-700 p-3 rounded-lg mb-4 text-sm text-center">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-4">
                            <div>
                                <label className="field-label">نام کاربری یا ایمیل</label>
                                <input
                                    className="field"
                                    value={login} onChange={(e) => setLogin(e.target.value)}
                                    placeholder="example@domain.com" required
                                />
                            </div>

                            <div>
                                <label className="field-label">رمز عبور</label>
                                <input
                                    type="password" className="field"
                                    value={password} onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" required
                                />
                            </div>

                            <div>
                                <label className="field-label">تایید امنیتی</label>
                                <div className="flex items-center gap-3">
                                    {captchaLoading ? (
                                        <div className="w-32 h-[52px] bg-parchment-200 animate-pulse rounded-lg" />
                                    ) : (
                                        <img src={captcha.image} alt="کپچا" className="rounded-lg border border-parchment-300" />
                                    )}
                                    <button type="button" onClick={fetchCaptcha} className="text-xs font-bold text-brand-600 hover:underline">
                                        🔄 تصویر جدید
                                    </button>
                                </div>
                                <input
                                    type="text" required value={captchaAnswer}
                                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                                    placeholder="کد داخل تصویر را وارد کنید"
                                    className="field mt-2 text-center tracking-widest font-bold"
                                />
                            </div>

                            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
                                {loading ? "در حال ورود..." : "ورود به بازی"}
                            </button>
                        </form>

                        <div className="mt-6 text-center text-sm text-ink-600">
                            <span>اکانت ندارید؟ </span>
                            <a href="/register" className="text-brand-600 font-bold hover:underline">ثبت‌نام</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}