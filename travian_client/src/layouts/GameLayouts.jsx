import { Outlet } from "react-router-dom";
import ResourceBar from "../components/ResourceBar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SideInfoBoards from "../components/SideInfoBoards";

export default function GameLayout() {
    return (
        <div style={{ minHeight: '100vh', background: '#A1BB79', direction: 'rtl' }}>
            {/* Wrapper */}
            <div style={{
                width: '100%',
                backgroundImage: "url('/assets/bgs/bgVillage-rtl.jpg')",
                backgroundPosition: 'center top',
            }}>
                {/* Header */}
                <div style={{ position: 'relative', width: '990px', margin: '0 auto', height: '115px' }}>
                    {/* Logo (RTL: right side) */}
                    <a href="/" style={{
                        display: 'block',
                        height: '43px',
                        width: '124px',
                        margin: '24px 7px 0 16px',
                        background: "url('/assets/layout/logoSmall.png') no-repeat",
                        float: 'right',
                    }} title="Travian" />

                    {/* Resource Bar */}
                    <ResourceBar />

                    {/* Navigation */}
                    <Navbar />

                    <div style={{ clear: 'both' }} />
                </div>

                {/* Main content area */}
                <div style={{ position: 'relative', minHeight: '600px', width: '990px', margin: '0 auto 10px auto' }}>
                    {/* Right Sidebar (RTL) */}
                    <SideInfoBoards />

                    {/* Content (RTL: left side) */}
                    <div id="contentOuterContainer">
                        <div className="contentTitle">&nbsp;</div>
                        <div className="contentContainer">
                            <div id="content" style={{ padding: '23px 23px 26px 23px' }}>
                                <Outlet />
                            </div>
                        </div>
                        <div className="contentFooter" />
                    </div>

                    <div style={{ clear: 'both' }} />
                </div>

                <Footer />
            </div>
        </div>
    );
}
