import Link from 'next/link';
import { Logo } from 'components/app/logo';
import { brand } from 'lib/brand';

const features = [
    {
        title: 'Answers every call, 24/7',
        body: 'Your AI receptionist picks up on the first ring, nights and weekends included, and sounds like a real person.'
    },
    {
        title: 'Captures leads automatically',
        body: 'It collects the caller’s name, number, and what they need, then texts you a summary the moment the call ends.'
    },
    {
        title: 'Knows your business',
        body: 'Trained on your services, service area, hours, and FAQs. It never makes up prices or promises.'
    },
    {
        title: 'Transfers when it matters',
        body: 'Emergencies and callers who want a human get sent straight to your phone.'
    }
];

const steps = [
    ['1', 'Tell us about your business', 'Services, hours, service area, and how you want calls handled.'],
    ['2', 'Get your number', 'Forward your existing line or use a new local number.'],
    ['3', 'Watch the leads come in', 'Every call, transcript, and lead in one dashboard.']
];

export default function HomePage() {
    return (
        <div className="bg-white">
            <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
                <Logo />
                <nav className="flex items-center gap-4 text-sm">
                    <a href="#how" className="hidden text-slate-600 hover:text-slate-900 sm:inline">
                        How it works
                    </a>
                    <Link href="/login" className="btn-ghost-sm">
                        Log in
                    </Link>
                </nav>
            </header>

            <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 text-center sm:px-6 sm:pt-20">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--brand)' }}>
                    AI receptionist for local businesses
                </p>
                <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">Never miss another call. Never lose another job.</h1>
                <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">{brand.tagline}</p>
                <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <a href={`mailto:${brand.supportEmail}?subject=AI%20receptionist%20demo`} className="btn-brand px-6 py-3 text-base">
                        Book a demo
                    </a>
                    <a href="#how" className="btn-ghost-sm px-6 py-3 text-base">
                        See how it works
                    </a>
                </div>
            </section>

            <section className="border-y border-slate-100 bg-slate-50">
                <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
                    {features.map((f) => (
                        <div key={f.title} className="card">
                            <h3 className="mb-2 font-semibold text-slate-900">{f.title}</h3>
                            <p className="text-sm text-slate-600">{f.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
                <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">Live in a day</h2>
                <ol className="grid gap-8 sm:grid-cols-3">
                    {steps.map(([n, title, body]) => (
                        <li key={n} className="text-center">
                            <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full font-bold text-white" style={{ background: 'var(--brand)' }}>
                                {n}
                            </span>
                            <h3 className="mb-1 font-semibold">{title}</h3>
                            <p className="text-sm text-slate-600">{body}</p>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="px-4 pb-20 sm:px-6">
                <div className="mx-auto max-w-4xl rounded-2xl px-6 py-12 text-center text-white" style={{ background: 'var(--brand)' }}>
                    <h2 className="text-3xl font-bold">Stop sending customers to voicemail.</h2>
                    <p className="mt-3 opacity-90">Every missed call is a job for your competitor.</p>
                    <a href={`mailto:${brand.supportEmail}?subject=AI%20receptionist%20demo`} className="mt-8 inline-block rounded-md bg-white px-6 py-3 font-semibold text-slate-900 hover:bg-slate-100">
                        Get started
                    </a>
                </div>
            </section>

            <footer className="border-t border-slate-100 py-8 text-center text-sm text-slate-500">
                © {new Date().getFullYear()} {brand.name} · {brand.domain}
            </footer>
        </div>
    );
}
