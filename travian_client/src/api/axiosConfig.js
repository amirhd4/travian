import axios from "axios";
import useGameStore from "../store/useGameStore";

// نکته امنیتی مرورگرها: برای اینکه کوکی httpOnly (با تنظیم SameSite=Lax) در محیط لوکال به درستی کار کند،
// فرانت و بک‌باند باید دقیقا روی یک هاست‌نیم (مثلا هر دو localhost یا هر دو 127.0.0.1) باشند.
const baseURL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000`;

const api = axios.create({
    baseURL: `${baseURL}/api/`,
    withCredentials: true, // ارسال و دریافت کوکی رفرش توکن
    timeout: 10000,        // جلوگیری از معلق ماندن درخواست‌ها در شبکه ضعیف
});

// اینترسپتور درخواست: تزریق خودکار Access Token
api.interceptors.request.use(
    (config) => {
        const token = useGameStore.getState().accessToken;
        if (token && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// مدیریت صف درخواست‌های معلق در زمان رفرش توکن
let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
    pendingQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    pendingQueue = [];
};

// اینترسپتور پاسخ: مدیریت خطاهای ۴۰۱ و رفرش خودکار توکن
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // اگر خطا مربوط به شبکه باشد یا پاسخی از سمت سرور دریافت نشده باشد
        if (!error.response) {
            return Promise.reject(error);
        }

        const isRefreshCall = originalRequest?.url?.includes("auth/token/refresh");
        const isLoginCall = originalRequest?.url?.includes("auth/login"); // یا هر آدرسی که برای ورود دارید

        // فقط در صورتی وارد پروسه رفرش می‌شویم که خطا ۴۰۱ باشد و درخواست مربوط به خود لاگین یا رفرش نباشد
        if (error.response.status === 401 && !originalRequest._retry && !isRefreshCall && !isLoginCall) {

            // اگر در حال حاضر یک درخواست رفرش در جریان است، بقیه درخواست‌ها را در صف نگه دار
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pendingQueue.push({ resolve, reject });
                })
                .then((newToken) => {
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                })
                .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // ارسال درخواست رفرش به بک‌اند (بدنه خالی است چون توکن در کوکی ارسال می‌شود)
                const { data } = await api.post("auth/token/refresh/", {});

                const newAccessToken = data.access;

                // به‌روزرسانی استیت مرکزی بازی
                useGameStore.getState().setAccessToken(newAccessToken);

                // آزاد کردن درخواست‌های منتظر در صف با توکن جدید
                processQueue(null, newAccessToken);

                // بازخوانی درخواست اصلی شکست خورده با توکن جدید
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                return api(originalRequest);

            } catch (refreshError) {
                // اگر رفرش توکن هم منقضی شده باشد، کاربر باید دوباره لاگین کند
                processQueue(refreshError, null);

                useGameStore.getState().clearUser();

                // برای جلوگیری از اختلال در رندر روت‌ها، هدایت به لاگین با کمی تاخیر یا مستقیما انجام شود
                if (window.location.pathname !== "/login") {
                    window.location.href = "/login";
                }

                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;