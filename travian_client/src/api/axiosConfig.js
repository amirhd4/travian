import axios from "axios";
import useGameStore from "../store/useGameStore";

// نکته مهم: این آدرس عمداً از "localhost" استفاده می‌کند نه "127.0.0.1".
// مرورگرها این دو را دو "سایت" کاملاً متفاوت در نظر می‌گیرند؛ چون کوکی
// refresh_token با SameSite=Lax ست شده، اگر فرانت‌اند (localhost:5173) و
// بک‌اند با هاست‌نیم متفاوتی (مثلا 127.0.0.1:8000) صدا زده شوند، مرورگر
// کوکی رفرش توکن را در درخواست‌های XHR/fetch ارسال نمی‌کند و در نتیجه بعد
// از هر رفرش صفحه، کاربر عملاً از حساب خارج می‌شد. با یکسان نگه داشتن
// هاست‌نیم (فقط پورت فرق دارد) این مشکل در حالت توسعه برطرف می‌شود.
const baseURL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const api = axios.create({
    baseURL: `${baseURL}/api/`,
    withCredentials: true, // برای ارسال/دریافت کوکی httpOnly رفرش توکن ضروریه
});

api.interceptors.request.use((config) => {
    const token = useGameStore.getState().accessToken;
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// جلوگیری از چند درخواست هم‌زمان رفرش وقتی چند ریکوئست با هم 401 می‌گیرن
let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
    pendingQueue.forEach(({ resolve, reject }) => {
        if (error) reject(error);
        else resolve(token);
    });
    pendingQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const isRefreshCall = originalRequest?.url?.includes("token/refresh");

        if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingQueue.push({ resolve, reject });
                }).then((newToken) => {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const { data } = await axios.post(
                    `${baseURL}/api/auth/token/refresh/`,
                    {},
                    { withCredentials: true }
                );

                const newAccessToken = data.access;
                useGameStore.getState().setAccessToken(newAccessToken);
                processQueue(null, newAccessToken);

                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                processQueue(refreshError, null);
                useGameStore.getState().clearUser();
                window.location.href = "/login";
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export default api;