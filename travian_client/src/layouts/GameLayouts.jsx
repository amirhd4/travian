import { Outlet } from "react-router-dom";
import ResourceBar from "../components/ResourceBar";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function GameLayout() {
    return (
        <div className="h-screen flex flex-col bg-[#cfe0a8]">

            <ResourceBar />

            <Navbar />

            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>

            <Footer />

        </div>
    );
}