import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axiosConfig.js";

const TRIBES = [
    { value: "GAUL", label: "گل‌ها", image: "/assets/tribes/gaul.png" },
    { value: "TEUTON", label: "توتون‌ها", image: "/assets/tribes/teuton.png" },
    { value: "ROMAN", label: "رومی‌ها", image: "/assets/tribes/roman.png" },
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
        username: "",
        email: "",
        phone_number: "",
        password: "",
        tribe: "ROMAN",
        starting_location: "RANDOM",
    });

    const [acceptTerms, setAcceptTerms] = useState(false);
    const [captchaAnswer, setCaptchaAnswer] = useState("");
    const [captcha, setCaptcha] = useState({ token: "", image: "" });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [captchaLoading, setCaptchaLoading] = useState(true);

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

    useEffect(() => {
        fetchCaptcha();
    }, [fetchCaptcha]);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

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
                accept_terms: acceptTerms,
                captcha_token: captcha.token,
                captcha_answer: captchaAnswer,
            });

            alert(data.message || "ثبت‌نام موفق");
            navigate("/login");
        } catch (err) {
            setError(
                err.response?.data?.username?.[0] ||
                err.response?.data?.email?.[0] ||
                err.response?.data?.phone_number?.[0] ||
                err.response?.data?.password?.[0] ||
                err.response?.data?.captcha_answer?.[0] ||
                err.response?.data?.accept_terms?.[0] ||
                err.response?.data?.non_field_errors?.[0] ||
                "خطا در ثبت‌نام"
            );
            // کپچا تک‌بارمصرف است؛ چه موفق چه ناموفق، توکن قبلی دیگر معتبر نیست
            fetchCaptcha();
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#c2d69b] flex items-center justify-center p-4 py-10">
            <div className="bg-[#f4ebd0] border-[8px] border-[#593d2b] rounded-xl shadow-2xl p-8 w-full max-w-xl">
                <h1 className="text-3xl font-bold text-[#593d2b] text-center mb-6">
                    ثبت‌نام در بازی
                </h1>

                {error && (
                    <div className="bg-red-200 border border-red-500 text-red-700 p-3 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-6 text-right" dir="rtl">

                    {/* اطلاعات کاربری */}
                    <fieldset className="border-2 border-[#c9b98a] rounded p-4">
                        <legend className="text-sm font-bold text-[#593d2b] px-2 bg-[#e5dcc0] rounded">
                            اطلاعات کاربری
                        </legend>
                        <div className="space-y-3 mt-2">
                            <div>
                                <label className="block font-bold mb-1 text-sm">نام کاربری:</label>
                                <input
                                    type="text" name="username" value={formData.username}
                                    onChange={handleChange} required
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block font-bold mb-1 text-sm">پست الکترونیک:</label>
                                <input
                                    type="email" name="email" value={formData.email}
                                    onChange={handleChange} required
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block font-bold mb-1 text-sm">شماره موبایل:</label>
                                <input
                                    type="tel" name="phone_number" value={formData.phone_number}
                                    onChange={handleChange} required
                                    placeholder="09xxxxxxxxx"
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block font-bold mb-1 text-sm">رمز عبور:</label>
                                <input
                                    type="password" name="password" value={formData.password}
                                    onChange={handleChange} required minLength={8}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        </div>
                    </fieldset>

                    {/* انتخاب نژاد */}
                    <fieldset className="border-2 border-[#c9b98a] rounded p-4">
                        <legend className="text-sm font-bold text-[#593d2b] px-2 bg-[#e5dcc0] rounded">
                            یک نژاد انتخاب کنید
                        </legend>
                        <p className="text-xs text-gray-600 mt-2 mb-3">
                            هر نژاد ویژگی‌های نظامی و اقتصادی متفاوتی دارد؛ قبل از ثبت‌نام راهنمای بازی را مطالعه کنید.
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {TRIBES.map((t) => (
                                <label key={t.value} className="text-center cursor-pointer">
                                    <input
                                        type="radio" name="tribe" value={t.value}
                                        checked={formData.tribe === t.value}
                                        onChange={handleChange}
                                        className="hidden"
                                    />
                                    <div className={`p-2 border-2 rounded transition ${
                                        formData.tribe === t.value ? "border-green-700 bg-green-100" : "border-gray-300 bg-white"
                                    }`}>
                                        <img
                                            src={t.image} alt={t.label}
                                            className="w-full h-20 object-contain mx-auto mb-1"
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                        <span className="text-xs font-bold">{t.label}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* محل شروع */}
                    <fieldset className="border-2 border-[#c9b98a] rounded p-4">
                        <legend className="text-sm font-bold text-[#593d2b] px-2 bg-[#e5dcc0] rounded">
                            محل شروع
                        </legend>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                            {STARTING_LOCATIONS.map((loc) => (
                                <label key={loc.value} className="flex items-center gap-1 text-xs font-bold cursor-pointer">
                                    <input
                                        type="radio" name="starting_location" value={loc.value}
                                        checked={formData.starting_location === loc.value}
                                        onChange={handleChange}
                                    />
                                    {loc.label}
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* اطلاعات بیشتر و قوانین */}
                    <fieldset className="border-2 border-[#c9b98a] rounded p-4">
                        <legend className="text-sm font-bold text-[#593d2b] px-2 bg-[#e5dcc0] rounded">
                            اطلاعات بیشتر
                        </legend>
                        <ul className="text-xs text-gray-700 space-y-1 mt-2 list-decimal list-inside">
                            <li>در صورت مشاهده‌ی هرگونه توهین به بازیکنان یا استفاده از الفاظ نامناسب، اکانت بازیکن خاطی بدون اخطار مسدود خواهد شد.</li>
                            <li>رمز اکانت خود را هرگز در اختیار هیچ‌کس، حتی مدیران بازی، قرار ندهید؛ مدیران هیچ‌وقت به آن نیاز ندارند.</li>
                        </ul>

                        <label className="flex items-center gap-2 mt-3 text-xs font-bold cursor-pointer">
                            <input
                                type="checkbox" checked={acceptTerms}
                                onChange={(e) => setAcceptTerms(e.target.checked)}
                            />
                            من قوانین را خوانده و قبول دارم.
                        </label>
                    </fieldset>

                    {/* کپچا */}
                    <fieldset className="border-2 border-[#c9b98a] rounded p-4">
                        <legend className="text-sm font-bold text-[#593d2b] px-2 bg-[#e5dcc0] rounded">
                            تایید امنیتی
                        </legend>
                        <div className="flex items-center gap-3 mt-2">
                            {captchaLoading ? (
                                <div className="w-40 h-[60px] bg-gray-200 animate-pulse rounded" />
                            ) : (
                                <img src={captcha.image} alt="کپچا" className="rounded border border-gray-400" />
                            )}
                            <button
                                type="button" onClick={fetchCaptcha}
                                className="text-xs font-bold text-blue-700 hover:underline"
                                title="کد جدید"
                            >
                                🔄 تصویر جدید
                            </button>
                        </div>
                        <input
                            type="text" required value={captchaAnswer}
                            onChange={(e) => setCaptchaAnswer(e.target.value)}
                            placeholder="کد داخل تصویر را وارد کنید"
                            className="w-full p-2 border rounded mt-2 text-center tracking-widest font-bold"
                        />
                    </fieldset>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#593d2b] text-white p-3 rounded mt-2 font-bold hover:bg-[#4a3224] transition disabled:bg-gray-400"
                    >
                        {loading ? "در حال ثبت‌نام..." : "ثبت نام"}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <span>قبلاً ثبت‌نام کرده‌اید؟ </span>
                    <Link to="/login" className="text-blue-600 font-bold">
                        ورود
                    </Link>
                </div>
            </div>
        </div>
    );
}