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

const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
};

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="/login" element={<Login />} />
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
            </Routes>
        </Router>
    );
}

export default App;