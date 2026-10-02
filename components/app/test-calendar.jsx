'use client';

import { useActionState } from 'react';
import { Submit } from './submit';

export function TestCalendar({ action }) {
    const [state, formAction] = useActionState(action, {});
    return (
        <form action={formAction} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <Submit className="btn-ghost-sm" pendingText="Checking…">
                Test calendar
            </Submit>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            {state?.message && <p className="text-sm text-green-700">{state.message}</p>}
        </form>
    );
}
