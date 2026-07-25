import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axiosConfig';

/**
 * VillageSearch - Dual-input village selector matching PHP Travian UX.
 *
 * Props:
 *   onVillageSelected(village) - callback with {id, name, x_coord, y_coord, owner}
 *   className - optional wrapper class
 */
export default function VillageSearch({ onVillageSelected, className = '' }) {
    const [searchName, setSearchName] = useState('');
    const [coordX, setCoordX] = useState('');
    const [coordY, setCoordY] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [coordError, setCoordError] = useState('');

    const dropdownRef = useRef(null);
    const debounceRef = useRef(null);
    const coordDebounceRef = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchByName = useCallback(async (query) => {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.get('game/villages/search/', { params: { name: query } });
            setSuggestions(data);
            setShowDropdown(data.length > 0);
        } catch {
            setSuggestions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleNameChange = (e) => {
        const val = e.target.value;
        setSearchName(val);
        setSelected(null);
        setCoordX('');
        setCoordY('');
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchByName(val), 250);
    };

    const handleSelectSuggestion = (village) => {
        setSelected(village);
        setSearchName(village.name);
        setCoordX(String(village.x_coord));
        setCoordY(String(village.y_coord));
        setSuggestions([]);
        setShowDropdown(false);
        onVillageSelected?.(village);
    };

    const doCoordLookup = useCallback(async (cx, cy) => {
        const x = parseInt(cx);
        const y = parseInt(cy);
        if (isNaN(x) || isNaN(y)) {
            setCoordError('مختصات نامعتبر');
            return;
        }
        setCoordError('');
        setLoading(true);
        try {
            const { data } = await api.get('game/villages/search/', { params: { x, y } });
            setSelected(data);
            setSearchName(data.name);
            onVillageSelected?.(data);
        } catch (err) {
            setCoordError(err.response?.data?.error || 'دهکده‌ای یافت نشد');
            setSelected(null);
            onVillageSelected?.(null);
        } finally {
            setLoading(false);
        }
    }, [onVillageSelected]);

    const handleCoordXChange = (e) => {
        setCoordX(e.target.value);
        setSelected(null);
        setSearchName('');
        clearTimeout(coordDebounceRef.current);
        if (e.target.value && coordY) {
            coordDebounceRef.current = setTimeout(() => doCoordLookup(e.target.value, coordY), 500);
        }
    };

    const handleCoordYChange = (e) => {
        setCoordY(e.target.value);
        setSelected(null);
        setSearchName('');
        clearTimeout(coordDebounceRef.current);
        if (coordX && e.target.value) {
            coordDebounceRef.current = setTimeout(() => doCoordLookup(coordX, e.target.value), 500);
        }
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <div>
                <label className="field-label">نام دهکده</label>
                <div className="relative">
                    <input
                        type="text"
                        className="field"
                        value={searchName}
                        onChange={handleNameChange}
                        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                        placeholder="حداقل ۲ حرف تایپ کنید..."
                        dir="rtl"
                    />
                    {loading && (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">...</span>
                    )}
                </div>
                {showDropdown && suggestions.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-parchment-300 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {suggestions.map((v) => (
                            <button
                                key={v.id}
                                type="button"
                                className="w-full text-right px-3 py-2 hover:bg-gold-50 text-sm text-ink-800 border-b border-parchment-100 last:border-b-0"
                                onClick={() => handleSelectSuggestion(v)}
                            >
                                <span className="font-bold">{v.name}</span>
                                <span className="text-xs text-ink-500 mr-2">
                                    ({v.x_coord}|{v.y_coord}) — {v.owner}
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 my-3">
                <div className="flex-1 border-t border-parchment-300" />
                <span className="text-xs text-ink-400 font-bold">یا</span>
                <div className="flex-1 border-t border-parchment-300" />
            </div>

            <div>
                <label className="field-label">مختصات (X | Y)</label>
                <div className="flex gap-2 items-center">
                    <input
                        type="number"
                        className="field text-center flex-1"
                        value={coordX}
                        onChange={handleCoordXChange}
                        placeholder="X"
                    />
                    <span className="text-ink-500 font-bold">|</span>
                    <input
                        type="number"
                        className="field text-center flex-1"
                        value={coordY}
                        onChange={handleCoordYChange}
                        placeholder="Y"
                    />
                </div>
                {coordError && (
                    <p className="text-xs text-rose-600 mt-1">{coordError}</p>
                )}
            </div>

            {selected && (
                <div className="mt-3 p-3 bg-green-50 border border-green-300 rounded-xl text-sm">
                    <span className="text-green-700 font-bold">
                        {selected.name} ({selected.x_coord}|{selected.y_coord})
                    </span>
                    <span className="text-green-500 text-xs mr-2">
                        — {selected.owner}
                    </span>
                </div>
            )}
        </div>
    );
}
