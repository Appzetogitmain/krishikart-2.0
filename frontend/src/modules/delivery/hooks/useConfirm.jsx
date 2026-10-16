import { useCallback, useState } from 'react';
import ConfirmDialog from '../components/modals/ConfirmDialog';

/**
 * Ask before acting:  if (!(await confirm({ title, message, confirmLabel }))) return;
 * Render the returned dialog once in the component.
 */
export function useConfirm() {
    const [request, setRequest] = useState(null);

    const confirm = useCallback(
        (options = {}) => new Promise((resolve) => setRequest({ ...options, resolve })),
        []
    );

    const close = (answer) => {
        request?.resolve(answer);
        setRequest(null);
    };

    const dialog = (
        <ConfirmDialog
            open={!!request}
            title={request?.title}
            message={request?.message}
            confirmLabel={request?.confirmLabel}
            cancelLabel={request?.cancelLabel}
            tone={request?.tone}
            onConfirm={() => close(true)}
            onCancel={() => close(false)}
        />
    );

    return [confirm, dialog];
}
