'use client';

import { useActionState } from 'react';
import { Submit } from './submit';

// Form bound to a server action returning {error} or {message}.
export function ActionForm({ action, submitLabel = 'Save', pendingText, className = 'space-y-4', children }) {
    const [state, formAction] = useActionState(action, {});
    return (
        <form action={formAction} className={className}>
            {children}
            <div className="flex items-center gap-3">
                <Submit pendingText={pendingText}>{submitLabel}</Submit>
                {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
                {state?.message && <p className="text-sm text-green-700">{state.message}</p>}
            </div>
        </form>
    );
}
