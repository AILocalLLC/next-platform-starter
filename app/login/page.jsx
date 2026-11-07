import { Logo } from 'components/app/logo';
import { LoginForm } from './login-form';

export const metadata = { title: 'Log in' };

export default function LoginPage() {
    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="mb-8 flex justify-center">
                    <Logo />
                </div>
                <div className="card">
                    <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
                    <LoginForm />
                </div>
            </div>
        </main>
    );
}
