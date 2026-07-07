import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import VillageMap from './pages/VillageMap';
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
import Hero from "./pages/Herro.jsx";
import Colonize from "./pages/Colonize.jsx";

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
            <Routes>
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                    path="/village"
                    element={<PrivateRoute><VillageMap /></PrivateRoute>}
                />
                <Route
                    path="/world-map"
                    element={<PrivateRoute><WorldMap /></PrivateRoute>}
                />
                <Route
                    path="/send-troops"
                    element={<PrivateRoute><SendTroops /></PrivateRoute>}
                />
                <Route
                    path="/reports"
                    element={<PrivateRoute><Reports /></PrivateRoute>}
                />
                <Route
                    path="/statistics"
                    element={<PrivateRoute><Statistics /></PrivateRoute>}
                />
                <Route path="/marketplace" element={<PrivateRoute><Marketplace /></PrivateRoute>} />
                <Route path="/world-wonder" element={<PrivateRoute><WorldWonder /></PrivateRoute>} />
                <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
                <Route path="/barracks" element={<PrivateRoute><Barracks /></PrivateRoute>} />
                <Route path="/embassy" element={<PrivateRoute><Embassy /></PrivateRoute>} />
                <Route path="/movements" element={<PrivateRoute><Movements /></PrivateRoute>} />
                <Route path="/hero" element={<PrivateRoute><Hero /></PrivateRoute>} />
                <Route path="/colonize" element={<PrivateRoute><Colonize /></PrivateRoute>} />
            </Routes>
        </Router>
    );
}

export default App;