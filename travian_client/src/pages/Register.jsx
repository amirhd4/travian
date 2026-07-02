import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axiosConfig.js";

export default function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        tribe: "ROMAN",
    });

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const { data } = await api.post("auth/register/", formData);

            alert(data.message || "ثبت‌نام موفق");

            navigate("/login");

        } catch (err) {
            setError(
                err.response?.data?.username?.[0] ||
                err.response?.data?.email?.[0] ||
                err.response?.data?.phone_number?.[0] ||
                err.response?.data?.password?.[0] ||
                err.response?.data?.non_field_errors?.[0] ||
                "خطا در ثبت‌نام"
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#c2d69b] flex items-center justify-center p-4">

            <div className="bg-[#f4ebd0] border-[8px] border-[#593d2b] rounded-xl shadow-2xl p-8 w-full max-w-md">

                <h1 className="text-3xl font-bold text-[#593d2b] text-center mb-6">
                    ثبت‌نام در بازی
                </h1>

                {error && (
                    <div className="bg-red-200 border border-red-500 text-red-700 p-3 rounded mb-4 text-sm text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4 text-right" dir="rtl">

                    {/* username */}
                    <div>
                        <label className="block font-bold mb-1">نام کاربری:</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            className="w-full p-2 border rounded"
                        />
                    </div>

                    {/* email */}
                    <div>
                        <label className="block font-bold mb-1">ایمیل:</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full p-2 border rounded"
                        />
                    </div>

                    {/* password */}
                    <div>
                        <label className="block font-bold mb-1">رمز عبور:</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength={8}
                            className="w-full p-2 border rounded"
                        />
                    </div>

                    {/* tribe */}
                    <div>
                        <label className="block font-bold mb-2">انتخاب نژاد:</label>

                        <div className="grid grid-cols-3 gap-2">

                            <label className="text-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="tribe"
                                    value="ROMAN"
                                    checked={formData.tribe === "ROMAN"}
                                    onChange={handleChange}
                                    className="hidden"
                                />
                                <div className={`p-2 border rounded ${formData.tribe === "ROMAN" ? "bg-green-700 text-white" : ""}`}>
                                    🛡️ Roman
                                </div>
                            </label>

                            <label className="text-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="tribe"
                                    value="TEUTON"
                                    checked={formData.tribe === "TEUTON"}
                                    onChange={handleChange}
                                    className="hidden"
                                />
                                <div className={`p-2 border rounded ${formData.tribe === "TEUTON" ? "bg-green-700 text-white" : ""}`}>
                                    🪓 Teuton
                                </div>
                            </label>

                            <label className="text-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="tribe"
                                    value="GAUL"
                                    checked={formData.tribe === "GAUL"}
                                    onChange={handleChange}
                                    className="hidden"
                                />
                                <div className={`p-2 border rounded ${formData.tribe === "GAUL" ? "bg-green-700 text-white" : ""}`}>
                                    🐎 Gaul
                                </div>
                            </label>

                        </div>
                    </div>

                    {/* submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#593d2b] text-white p-3 rounded mt-4"
                    >
                        {loading ? "در حال ثبت‌نام..." : "ساخت اکانت"}
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