import { create } from 'zustand';

const useGameStore = create((set) => ({
    user: null,
    accessToken: null, // فقط در حافظه (RAM) نگه‌داری می‌شه، هرگز در localStorage ذخیره نمی‌شه
    village: null,
    resources: { wood: 0, clay: 0, iron: 0, crop: 0 },
    production: { wood: 0, clay: 0, iron: 0, crop: 0 },
    hydrated: false,
    maxStorage: 800,
    maxGranary: 800,

    // لیست دهکده‌های واقعی بازیکن (از /api/game/villages/) و دهکده‌ی فعال فعلی.
    // قبلا هیچ‌کدام از این‌ها وجود نداشت و همه‌ی صفحات village_id: 1 را
    // هاردکد کرده بودند؛ به همین دلیل سیستم چند دهکده‌ای عملا کار نمی‌کرد.
    villages: [],
    activeVillageId: null,
    heroImageVersion: 0,

    setCapacities: (storage, granary) => set({ maxStorage: storage, maxGranary: granary }),

    setAccessToken: (token) => set({ accessToken: token }),

    setHydrated: (value) => set({ hydrated: value }),

    setUser: (user) => {
        localStorage.setItem("user", JSON.stringify(user));
        set({ user });
    },

    setVillages: (villages) => set({ villages }),

    setActiveVillageId: (villageId) => set({ activeVillageId: villageId }),

    refreshHeroImage: () => set((state) => ({ heroImageVersion: state.heroImageVersion + 1 })),

    // قبلا این استیت هیچ‌وقت از سرور آپدیت نمی‌شد؛ ResourceBar فقط مقادیر
    // پیش‌فرض هاردکد را هر ثانیه در کلاینت تیک می‌زد.
    setProduction: (production) => set({ production }),

    // 🔴 تابع بسیار مهم برای زمان خروج یا انقضای نشست
    clearUser: () => {
        localStorage.removeItem("user");
        set({ user: null, village: null, accessToken: null, villages: [], activeVillageId: null });
    },

    setVillage: (villageData) => set({ village: villageData }),

    updateResources: (newResources) => set((state) => ({
        resources: { ...state.resources, ...newResources }
    })),

    // جلوگیری از منفی شدن منابع هنگام کسر هزینه
    deductResources: (cost) => set((state) => ({
        resources: {
            wood: Math.max(0, state.resources.wood - (cost.wood || 0)),
            clay: Math.max(0, state.resources.clay - (cost.clay || 0)),
            iron: Math.max(0, state.resources.iron - (cost.iron || 0)),
            crop: Math.max(0, state.resources.crop - (cost.crop || 0)),
        }
    })),

    // تولید منابع در هر ثانیه (برای نمایش زنده در UI). گندم می‌تواند نرخ
    // منفی داشته باشد (وقتی مصرف نیروها از تولید بیشتر است)، پس زیر صفر
    // clamp می‌شود تا عدد منفی لحظه‌ای در UI نمایش داده نشود.
    tickResources: () => set((state) => ({
        resources: {
            wood: state.resources.wood + (state.production.wood / 3600),
            clay: state.resources.clay + (state.production.clay / 3600),
            iron: state.resources.iron + (state.production.iron / 3600),
            crop: Math.max(0, state.resources.crop + (state.production.crop / 3600)),
        }
    })),
}));

export default useGameStore;