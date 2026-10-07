import Link from 'next/link';
import { brand } from 'lib/brand';

export function Logo({ href = '/' }) {
    return (
        <Link href={href} className="flex items-center gap-2 text-lg font-bold text-slate-900 no-underline">
            {brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={brand.logoUrl} alt="" className="h-8 w-8 rounded" />
            ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-md text-sm font-extrabold text-white" style={{ background: 'var(--brand)' }}>
                    {brand.name.slice(0, 2)}
                </span>
            )}
            {brand.name}
        </Link>
    );
}
