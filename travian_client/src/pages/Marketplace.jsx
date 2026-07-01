import { useState } from 'react';
import api from '../api/axiosConfig';
import Navbar from '../components/Navbar';
import ResourceBar from '../components/ResourceBar';
import useGameStore from '../store/useGameStore';

export default function Marketplace() {
    const { resources } = useGameStore();
    const [targetVillageId, setTargetVillageId] = useState('');
    const [payload, setPayload] = useState({ wood: 0, clay: 0, iron: 0, crop: 0 });
    const [loading, setLoading] = useState(false);

    const handleSend = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.post('game/marketplace/send/', {
                source_village_id: 1, // آی‌دی دهکده فعال
                target_village_id: targetVillageId,
                resources: payload
            });
            alert(response.data.message);
            // در اینجا باید منابع استیت فرانت‌اند هم کسر شود
        } catch (error) {
            alert(error.response?.data?.error || "خطا در ارسال منابع");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen bg-stone-100 pt-28 flex flex-col items-center">
            <ResourceBar />
            <Navbar />

            <div className="bg-white p-8 rounded-lg shadow-xl border-t-4 border-travian-gold max-w-md w-full">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">⚖️ بازارچه</h2>

                <form onSubmit={handleSend} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">شناسه دهکده مقصد:</label>
                        <input
                            type="number" required
                            className="w-full p-2 border rounded focus:border-travian-gold outline-none"
                            value={targetVillageId} onChange={(e) => setTargetVillageId(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                        {['wood', 'clay', 'iron', 'crop'].map((res) => (
                            <div key={res}>
                                <label className="block text-xs font-bold text-gray-600 mb-1 capitalize">
                                    {res === 'wood' ? '🪵 چوب' : res === 'clay' ? '🧱 خشت' : res === 'iron' ? '⚒️ آهن' : '🌾 گندم'}:
                                </label>
                                <input
                                    type="number" min="0" max={resources[res]}
                                    className="w-full p-1 border rounded text-center"
                                    value={payload[res]}
                                    onChange={(e) => setPayload({...payload, [res]: e.target.value})}
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        type="submit" disabled={loading}
                        className="w-full bg-amber-600 text-white p-3 rounded font-bold hover:bg-amber-700 transition"
                    >
                        {loading ? "در حال ارسال..." : "ارسال تجار 🐪"}
                    </button>
                </form>
            </div>
        </div>
    );
}