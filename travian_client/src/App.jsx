import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import WorldMap from './pages/WorldMap';
import SendTroops from './pages/SendTroops';
import Reports from "./pages/Reports.jsx";
import Statistics from "./pages/Statistics.jsx";
import Marketplace from "./pages/Marketplace.jsx";
import WorldWonder from "./pages/WorldWonder.jsx";
import Messages from "./pages/Messages.jsx";
import Barracks from "./pages/Barracks.jsx";
import Embassy from "./pages/Embassy.jsx";
import Register from "./pages/Register.jsx";
import useGameStore from "./store/useGameStore.js";
import { useEffect } from "react";
import api from "./api/axiosConfig.js";
import Movements from "./pages/Movements.jsx";
import Hero from "./pages/Hero.jsx";
import Colonize from "./pages/Colonize.jsx";
import FarmList from "./pages/FarmList.jsx";
import ServerStatusBanner from "./components/ServerStatusBanner.jsx";
import Quests from "./pages/Quests.jsx";
import GoldShop from "./pages/GoldShop.jsx";
import Checkout from "./pages/Checkout.jsx";
import PlusAccount from "./pages/PlusAccount.jsx";
import Blacksmith from "./pages/Blacksmith.jsx";
import ResourceFields from "./pages/ResourceFields.jsx";
import VillageCenter from "./pages/VillageCenter.jsx";
import GameLayout from "./layouts/GameLayouts.jsx";
import { Outlet } from "react-router-dom";
import VillagesOverview from "./pages/VillagesOverview.jsx";
import Artifacts from "./pages/Artifacts.jsx";

const PrivateRoute = ({ children }) => {
    const accessToken = useGameStore((state) => state.accessToken);
    const hydrated = useGameStore((state) => state.hydrated);

    // تا وقتی تلاش برای رفرش خودکار نشست تموم نشده، ریدایرکت نکن
    if (!hydrated) {
        return (
            <div className="w-full h-screen flex items-center justify-center text-gray-500 font-bold">
                در حال بررسی نشست...
            </div>
        );
    }

    return accessToken ? children : <Navigate to="/login" />;
};

function App() {
    const setAccessToken = useGameStore((state) => state.setAccessToken);
    const setUser = useGameStore((state) => state.setUser);
    const setHydrated = useGameStore((state) => state.setHydrated);
    const setVillages = useGameStore((state) => state.setVillages);
    const setActiveVillageId = useGameStore((state) => state.setActiveVillageId);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const { data } = await api.post('auth/token/refresh/');
                setAccessToken(data.access);

                const me = await api.get('auth/me/');
                setUser(me.data);
                try {
                    const villagesRes = await api.get('game/villages/');
                    setVillages(villagesRes.data);
                    const capital = villagesRes.data.find((v) => v.is_capital) || villagesRes.data[0];
                    if (capital) {
                        setActiveVillageId(capital.id);
                    }
                } catch (villageError) {
                    console.error("خطا در دریافت لیست دهکده‌ها", villageError);
                }
            } catch (error) {
            } finally {
                setHydrated(true);
            }
        };

        bootstrap();
    }, [setAccessToken, setUser, setHydrated, setVillages, setActiveVillageId]);

    return (
        <Router>
            <ServerStatusBanner />
            <Routes>
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route
                    element={
                        <PrivateRoute>
                            <GameLayout />
                        </PrivateRoute>
                    }
                >

                    <Route path="/village" element={<ResourceFields />} />
                    <Route path="/dorf2" element={<VillageCenter />} />
                    <Route path="/world-map" element={<WorldMap />} />
                    <Route path="/send-troops" element={<SendTroops />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/statistics" element={<Statistics />} />
                    <Route path="/marketplace" element={<Marketplace />} />
                    <Route path="/world-wonder" element={<WorldWonder />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/barracks" element={<Barracks />} />
                    <Route path="/embassy" element={<Embassy />} />
                    <Route path="/movements" element={<Movements />} />
                    <Route path="/hero" element={<Hero />} />
                    <Route path="/colonize" element={<Colonize />} />
                    <Route path="/farm-list" element={<FarmList />} />
                    <Route path="/quests" element={<Quests />} />
                    <Route path="/gold-shop" element={<GoldShop />} />
                    <Route path="/checkout/:authority" element={<Checkout />} />
                    <Route path="/plus" element={<PlusAccount />} />
                    <Route path="/blacksmith" element={<Blacksmith />} />
                    <Route path="/villages" element={<VillagesOverview />} />
                    <Route path="/artifacts" element={<Artifacts />} />
                </Route>
            </Routes>
        </Router>
    );
}

export default App;