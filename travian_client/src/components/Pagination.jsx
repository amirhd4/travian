import { useMemo } from 'react';

/**
 * Pagination - Reusable pagination component matching Travian UI style.
 *
 * Props:
 *   count       - total number of items
 *   limit       - items per page
 *   offset      - current offset
 *   onChange(offset) - callback when page changes
 */
export default function Pagination({ count, limit, offset, onChange }) {
    const totalPages = Math.ceil(count / limit);
    const currentPage = Math.floor(offset / limit) + 1;

    const pages = useMemo(() => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        const result = [];
        result.push(1);
        if (currentPage > 3) result.push('...');
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            result.push(i);
        }
        if (currentPage < totalPages - 2) result.push('...');
        result.push(totalPages);
        return result;
    }, [totalPages, currentPage]);

    if (count <= limit) return null;

    const btnStyle = (active = false, disabled = false) => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '32px',
        height: '32px',
        padding: '0 8px',
        fontSize: '12px',
        fontWeight: 'bold',
        border: '1px solid #C9C9C9',
        borderRadius: '4px',
        cursor: disabled ? 'default' : 'pointer',
        background: active ? '#498843' : disabled ? '#F0F0F0' : '#FFF',
        color: active ? '#FFF' : disabled ? '#AAA' : '#252525',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
                style={btnStyle(false, currentPage === 1)}
                disabled={currentPage === 1}
                onClick={() => onChange((currentPage - 2) * limit)}
            >
                ‹
            </button>

            {pages.map((page, i) =>
                page === '...' ? (
                    <span key={`e${i}`} style={{ padding: '0 4px', color: '#777', fontSize: '12px' }}>...</span>
                ) : (
                    <button
                        key={page}
                        style={btnStyle(page === currentPage)}
                        onClick={() => onChange((page - 1) * limit)}
                    >
                        {page}
                    </button>
                )
            )}

            <button
                style={btnStyle(false, currentPage === totalPages)}
                disabled={currentPage === totalPages}
                onClick={() => onChange(currentPage * limit)}
            >
                ›
            </button>

            <span style={{ fontSize: '11px', color: '#777', marginRight: '8px' }}>
                {count} مورد — صفحه {currentPage} از {totalPages}
            </span>
        </div>
    );
}
