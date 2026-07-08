import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosConfig";
import useGameStore from "../store/useGameStore";

export default function Login() {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const setUser = useGameStore((s) => s.setUser);
    const setAccessToken = useGameStore((s) => s.setAccessToken);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { data } = await api.post("auth/login/", {
                username: login,
                password,
            });

            // refresh token به صورت httpOnly cookie توسط خود سرور ست شده؛
            // اینجا فقط access token (در حافظه) و اطلاعات کاربر رو نگه می‌داریم
            setAccessToken(data.access);
            setUser(data.user);

            navigate("/village");

        } catch (err) {
            setError("نام کاربری یا رمز عبور اشتباه است");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen game-sky-bg flex items-center justify-center p-4">
r
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
                        <label className="block font-bold mb-1">
                            نام کاربری یا ایمیل:
                        </label>
                        <input
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#593d2b]"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            placeholder="example@domain.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block font-bold mb-1">
                            رمز عبور:
                        </label>
                        <input
                            type="password"
                            className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-[#593d2b]"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#593d2b] hover:bg-[#4a3224] text-white p-3 rounded transition"
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