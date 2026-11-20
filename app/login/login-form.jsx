'use client';

import { useActionState } from 'react';
import { sendReset, signIn } from './actions';

export function LoginForm() {
    const [state, action, pending] = useActionState(signIn, {});
    const [resetState, resetAction, resetPending] = useActionState(sendReset, {});
    const message = state.error || resetState.error || resetState.message;

    return (
        <form action={action} className="space-y-4">
            <div>
                <label className="label" htmlFor="email">
                    Email
                </label>
                <input id="email" name="email" type="email" required autoComplete="email" className="field" />
            </div>
            <div>
                <label className="label" htmlFor="password">
                    Password
                </label>
                <input id="password" name="password" type="password" autoComplete="current-password" className="field" />
            </div>
            {message && <p className={`text-sm ${resetState.message ? 'text-green-700' : 'text-red-600'}`}>{message}</p>}
            <button type="submit" disabled={pending} className="btn-brand w-full">
                {pending ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="submit" formAction={resetAction} formNoValidate disabled={resetPending} className="w-full text-center text-sm text-slate-500 hover:underline">
                Forgot password?
            </button>
        </form>
    );
}
