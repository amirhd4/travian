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
                setError("تعداد تلاش‌های شما زیاد بوده؛ لطفا کمی صبر کنید و دوباره امتحان کنید.");
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
        <div className="min-h-screen game-sky-bg flex items-center justify-center p-4">
            <div className="bg-[#f4ebd0] border-[8px] border-[#593d2b] rounded-xl shadow-2xl p-8 w-full max-w-md">
                <h1 className="text-3xl font-bold text-[#593d2b] text-center mb-6">
                    ورود به بازی
                </h1>

                {error && (
                    <div className="bg-red-200 border border-red-500 text-red-700 p-3 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4 text-right" dir="rtl">
                    <div>
                        <label className="block font-bold mb-1">نام کاربری یا ایمیل:</label>
                        <input
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#593d2b]"
                            value={login} onChange={(e) => setLogin(e.target.value)}
                            placeholder="example@domain.com" required
                        />
                    </div>

                    <div>
                        <label className="block font-bold mb-1">رمز عبور:</label>
                        <input
                            type="password"
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#593d2b]"
                            value={password} onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••" required
                        />
                    </div>

                    <div>
                        <label className="block font-bold mb-1 text-sm">تایید امنیتی:</label>
                        <div className="flex items-center gap-3">
                            {captchaLoading ? (
                                <div className="w-32 h-[50px] bg-gray-200 animate-pulse rounded" />
                            ) : (
                                <img src={captcha.image} alt="کپچا" className="rounded border border-gray-400" />
                            )}
                            <button type="button" onClick={fetchCaptcha} className="text-xs font-bold text-blue-700 hover:underline">
                                🔄 تصویر جدید
                            </button>
                        </div>
                        <input
                            type="text" required value={captchaAnswer}
                            onChange={(e) => setCaptchaAnswer(e.target.value)}
                            placeholder="کد داخل تصویر را وارد کنید"
                            className="w-full p-2 border rounded mt-2 text-center tracking-widest font-bold"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#593d2b] hover:bg-[#4a3224] text-white p-3 rounded transition disabled:bg-gray-400"
                    >
                        {loading ? "در حال ورود..." : "ورود"}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <span>اکانت ندارید؟ </span>
                    <a href="/register" className="text-blue-600 font-bold">
                        ثبت‌نام
                    </a>
                </div>
            </div>
        </div>
    );
}