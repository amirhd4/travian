import { useState } from 'react';
import useGameStore from '../store/useGameStore';
import api from '../api/axiosConfig';
import { Modal } from './Modal';

export default function VillageNameSign({ village }) {
    const activeVillageId = useGameStore((state) => state.activeVillageId);
    const [editing, setEditing] = useState(false);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!village) return null;

    const loyalty = village.loyalty ?? 100;
    let loyaltyStyle = 'high';
    if (loyalty <= 20) loyaltyStyle = 'low';
    else if (loyalty <= 50) loyaltyStyle = 'medium';

    const handleClick = () => {
        setNewName(village.name);
        setError('');
        setEditing(true);
    };

    const handleSave = async () => {
        const trimmed = newName.trim();
        if (!trimmed || trimmed === village.name) {
            setEditing(false);
            return;
        }
        setSaving(true);
        setError('');
        try {
            const { data } = await api.post('game/villages/rename/', {
                village_id: activeVillageId,
                name: trimmed,
            });
            useGameStore.getState().setVillages(
                useGameStore.getState().villages.map((v) =>
                    v.id === activeVillageId ? { ...v, name: data.name } : v
                )
            );
            setEditing(false);
        } catch (err) {
            setError(err.response?.data?.error || 'خطا در تغییر نام');
        } finally {
            setSaving(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
    };

    return (
        <>
            <div id="villageName">
                <div className="clickable" title="تغییر نام دهکده" onClick={handleClick}>
                    <span id="villageNameField">{village.name}</span>
                    <br />
                    <span className={`loyalty ${loyaltyStyle}`}>
                        وفاداری {loyalty}%
                    </span>
                </div>
            </div>

            <Modal open={editing} onClose={() => setEditing(false)} title="تغییر نام دهکده" icon="✏️" size="sm">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                        <label className="field-label">نام فعلی: <b>{village.name}</b></label>
                    </div>
                    <div>
                        <label className="field-label">نام جدید</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={50}
                            autoFocus
                            className="field"
                            style={{ width: '100%' }}
                            placeholder="نام جدید دهکده را وارد کنید..."
                        />
                    </div>
                    {error && (
                        <p style={{ color: '#DE0000', fontSize: '11px', fontWeight: 'bold' }}>{error}</p>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button onClick={handleSave} disabled={saving} className="btn-primary" style={{ flex: 1 }}>
                            {saving ? 'در حال ذخیره...' : 'ذخیره نام'}
                        </button>
                        <button onClick={() => setEditing(false)} className="btn-ghost" style={{ flex: 1 }}>
                            انصراف
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
