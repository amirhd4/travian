import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ResourceBar from "../components/ResourceBar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SideInfoBoards from "../components/SideInfoBoards";
import { useEffect } from "react";
import useGameStore from "../store/useGameStore";
import api from "../api/axiosConfig";

const BODY_CLASS_MAP = {
    '/village': 'village1',
    '/dorf2': 'village2',
    '/world-map': 'map',
};

export default function GameLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const clearUser = useGameStore((state) => state.clearUser);

    useEffect(() => {
        document.body.className = BODY_CLASS_MAP[location.pathname] || '';
        return () => { document.body.className = ''; };
    }, [location.pathname]);

    const handleLogout = async (e) => {
        e.preventDefault();
        try { await api.post('auth/logout/'); } catch { /* ignore */ }
        finally { clearUser(); navigate('/login'); }
    };

    return (
        <div>
            <div id="wrapper">
                <img id="staticElements" src="/assets/layout/bgIngameStaticElements-rtl.png" alt="" />
                <div className="bodyWrapper">
                    <div id="header">
                        <div id="mtop">
                            <div id="logoutContainer">
                                <a id="logout" href="/login" title="خروج" onClick={handleLogout}>خروج</a>
                            </div>
                            <a id="logo" href="/" title="Travian"></a>
                            <ResourceBar />
                            <Navbar />
                            <div className="clear"></div>
                        </div>
                    </div>
                    <div id="mid">
                        <div id="contentOuterContainer">
                            <div className="contentTitle">&nbsp;</div>
                            <div className="contentContainer">
                                <div id="content">
                                    <Outlet />
                                </div>
                            </div>
                            <div className="contentFooter">&nbsp;</div>
                        </div>

                        <SideInfoBoards />

                        <Footer />

                        <div className="clear"></div>
                    </div>
                </div>

                <div id="ce"></div>
            </div>
        </div>
    );
}
