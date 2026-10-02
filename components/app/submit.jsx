'use client';

import { useFormStatus } from 'react-dom';

export function Submit({ children, pendingText = 'Saving…', className = 'btn-brand' }) {
    const { pending } = useFormStatus();
    return (
        <button type="submit" disabled={pending} className={className}>
            {pending ? pendingText : children}
        </button>
    );
}
