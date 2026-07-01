import { create } from 'zustand';

const useGameStore = create((set) => ({
    user: null,
    village: null,
    resources: { wood: 0, clay: 0, iron: 0, crop: 0 },

    production: { wood: 300, clay: 300, iron: 300, crop: 150 },

    setUser: (userData) => set({ user: userData }),
    setVillage: (villageData) => set({ village: villageData }),
    updateResources: (newResources) => set((state) => ({
        resources: { ...state.resources, ...newResources }
    })),

    deductResources: (cost) => set((state) => ({
        resources: {
            wood: state.resources.wood - cost.wood,
            clay: state.resources.clay - cost.clay,
            iron: state.resources.iron - cost.iron,
            crop: state.resources.crop - cost.crop,
        }
    })),
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