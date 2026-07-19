import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosConfig';
import useGameStore from '../store/useGameStore';

const TRIBE_IMAGE_MAP = {
    ROMAN: 1,
    TEUTON: 2,
    GAUL: 3,
};

export default function QuestMasterSidebar() {
    const navigate = useNavigate();
    const user = useGameStore((state) => state.user);
    const [hasActiveQuest, setHasActiveQuest] = useState(false);

    const checkQuests = useCallback(async () => {
        try {
            const { data } = await api.get('game/quests/');
            const hasClaimable = data.some((q) => q.is_completed && !q.is_reward_claimed);
            setHasActiveQuest(hasClaimable);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        checkQuests();
        const interval = setInterval(checkQuests, 30000);
        return () => clearInterval(interval);
    }, [checkQuests]);

    if (!user) return null;

    const tribeNum = TRIBE_IMAGE_MAP[user.tribe] || 1;
    const imgSrc = `/assets/quests/masterNation${tribeNum}-rtl.png`;

    return (
        <div className="questMaster" onClick={() => navigate('/quests')} title="کوئست‌ها">
            <img src={imgSrc} alt="Quest Master" className="questMasterImg" />
        </div>
    );
}
