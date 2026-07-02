// src/api/axiosConfig.js
import axios from "axios";

// استفاده از fallback برای زمانی که متغیر محیطی در دسترس نیست
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
    baseURL: `${baseURL}/api/`,
});

// ارسال اتوماتیک Access Token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("access");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// مدیریت اتوماتیک Refresh Token هنگام منقضی شدن اکسس توکن
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // اگر ارور 401 (عدم دسترسی) بود و قبلاً تلاش نکرده بودیم
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                const refreshToken = localStorage.getItem("refresh");
                if (!refreshToken) {
                    throw new Error("توکن رفرش وجود ندارد");
                }

                // درخواست توکن جدید از بک‌اند
                const response = await axios.post(`${baseURL}/api/auth/token/refresh/`, {
                    refresh: refreshToken
                });

                // ذخیره توکن جدید
                const newAccessToken = response.data.access;
                localStorage.setItem("access", newAccessToken);

                // آپدیت کردن هدر و تکرار درخواست ناموفق قبلی
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                // اگر رفرش توکن هم منقضی شده بود، کاربر را بنداز بیرون
                localStorage.removeItem("access");
                localStorage.removeItem("refresh");
                window.location.href = "/login";
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;