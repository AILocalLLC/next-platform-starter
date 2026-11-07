import '../styles/globals.css';
import { brand } from 'lib/brand';

export const metadata = {
    title: {
        template: `%s | ${brand.name}`,
        default: brand.name
    },
    description: brand.tagline
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href={brand.logoUrl || '/favicon.svg'} sizes="any" />
            </head>
            <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased" style={{ '--brand': brand.color }}>
                {children}
            </body>
        </html>
    );
}
