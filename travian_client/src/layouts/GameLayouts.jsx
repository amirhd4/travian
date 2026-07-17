import { Outlet } from "react-router-dom";
import ResourceBar from "../components/ResourceBar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SideInfoBoards from "../components/SideInfoBoards";
import { useEffect } from "react";

export default function GameLayout() {
    useEffect(() => {
        document.body.className = "";
        return () => { document.body.className = ""; };
    }, []);

    return (
        <div>
            <div id="wrapper">
                <img id="staticElements" src="/assets/layout/bgIngameStaticElements-rtl.png" alt="" />
                <div id="logoutContainer">
                    <a id="logout" href="/login" title="خروج">&nbsp;</a>
                </div>
                <div className="bodyWrapper">
                    <div id="header">
                        <div id="mtop">
                            <a id="logo" href="/" title="Travian"></a>
                            {<ResourceBar />}
                            {<Navbar />}
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

                        {<SideInfoBoards />}

                        {<Footer />}

                        <div className="clear"></div>
                    </div>
                </div>

                <div id="ce"></div>
            </div>
        </div>
    );
}
