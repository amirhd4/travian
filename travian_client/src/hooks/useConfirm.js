import { useState, useCallback } from 'react';
import { ConfirmModal } from '../components/Modal';

export function useConfirm() {
    const [state, setState] = useState(null);

    const confirm = useCallback((message, opts = {}) => {
        return new Promise((resolve) => {
            setState({ message, resolve, ...opts });
        });
    }, []);

    const handle = (result) => {
        state?.resolve(result);
        setState(null);
    };

    const ConfirmUI = (
        <ConfirmModal
            open={!!state}
            onConfirm={() => handle(true)}
            onCancel={() => handle(false)}
            message={state?.message}
            danger={state?.danger}
            title={state?.title || 'تایید عملیات'}
            confirmLabel={state?.confirmLabel}
        />
    );

    return { confirm, ConfirmUI };
}