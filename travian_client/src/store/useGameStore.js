import { create } from 'zustand';

const useGameStore = create((set) => ({
    user: null,
    accessToken: null, // فقط در حافظه (RAM) نگه‌داری می‌شه، هرگز در localStorage ذخیره نمی‌شه
    village: null,
    resources: { wood: 0, clay: 0, iron: 0, crop: 0 },
    production: { wood: 300, clay: 300, iron: 300, crop: 150 },
    hydrated: false,

    setAccessToken: (token) => set({ accessToken: token }),

    setHydrated: (value) => set({ hydrated: value }),

    setUser: (user) => {
        localStorage.setItem("user", JSON.stringify(user));
        set({ user });
    },

    // 🔴 تابع بسیار مهم برای زمان خروج یا انقضای نشست
    clearUser: () => {
        localStorage.removeItem("user");
        set({ user: null, village: null, accessToken: null });
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

    // تولید منابع در هر ثانیه (برای نمایش زنده در UI)
    tickResources: () => set((state) => ({
        resources: {
            wood: state.resources.wood + (state.production.wood / 3600),
            clay: state.resources.clay + (state.production.clay / 3600),
            iron: state.resources.iron + (state.production.iron / 3600),
            crop: state.resources.crop + (state.production.crop / 3600),
        }
    })),
}));

export default useGameStore;