import { Outlet, useLocation, useNavigate } from "react-router-dom";
import ResourceBar from "../components/ResourceBar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SideInfoBoards from "../components/SideInfoBoards";
import VillageNameSign from "../components/VillageNameSign";
import QuestMasterSidebar from "../components/QuestMasterSidebar";
import { useEffect } from "react";
import useGameStore from "../store/useGameStore";
import api from "../api/axiosConfig";

const BODY_CLASS_MAP = {
    '/village': 'village1 gidRessources',
    '/dorf2': 'village2',
    '/world-map': 'map',
};

export default function GameLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const clearUser = useGameStore((state) => state.clearUser);
    const villages = useGameStore((state) => state.villages);
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const activeVillage = villages.find((v) => v.id === activeVillageId);

    useEffect(() => {
        document.body.className = 'v35 ' + (BODY_CLASS_MAP[location.pathname] || '');
        return () => { document.body.className = ''; };
    }, [location.pathname]);

    const handleLogout = async (e) => {
        e.preventDefault();
        try { await api.post('auth/logout/'); } catch { /* ignore */ }
        finally { clearUser(); navigate('/login'); }
    };

    return (
        <div id="wrapper">
            <img id="staticElements" alt="" />
            <div id="logoutContainer">
                <a
                  id="logout"
                  href="/login"
                  title="خروج"
                  onClick={handleLogout}
                >
                  &nbsp;
                </a>
            </div>
            <div className="bodyWrapper">
                <div id="header">
                    <div id="mtop">
                        <a id="logo" href="/" title="Travian"></a>
                        <ResourceBar />
                        <Navbar />
                        <div className="clear"></div>
                    </div>
                </div>
                <div id="mid">
                    <div className="clear"></div>
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
                    <VillageNameSign village={activeVillage} />
                    <QuestMasterSidebar />
                    <Footer />
                </div>
            </div>
            <div id="ce"></div>
        </div>
    );
}
