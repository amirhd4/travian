import useGameStore from '../store/useGameStore';

export default function VillageNameSign({ village }) {
    const activeVillageId = useGameStore((state) => state.activeVillageId);

    if (!village) return null;

    const loyalty = village.loyalty ?? 100;
    let loyaltyStyle = 'high';
    if (loyalty <= 20) loyaltyStyle = 'low';
    else if (loyalty <= 50) loyaltyStyle = 'medium';

    return (
        <div id="villageName">
            <div className="clickable" title="تغییر نام دهکده">
                <span id="villageNameField">{village.name}</span>
                <br />
                <span className={`loyalty ${loyaltyStyle}`}>
                    وفاداری {loyalty}%
                </span>
            </div>
        </div>
    );
}
