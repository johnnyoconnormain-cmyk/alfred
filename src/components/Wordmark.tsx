import Link from 'next/link';

/**
 * The mark: a cut ground line with the horizon above it. Drawn rather than
 * imported so it stays crisp at any size and needs no asset pipeline.
 */
export function Wordmark({
  href = '/',
  size = 'md',
  tone = 'ink',
}: {
  href?: string | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'ink' | 'paper';
}) {
  const dims = { sm: 18, md: 22, lg: 28 }[size];
  const text = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }[size];
  const color = tone === 'paper' ? 'text-paper' : 'text-ink';

  const content = (
    <span className={`inline-flex items-center gap-2 ${color}`}>
      <svg width={dims} height={dims} viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <rect x="1" y="1" width="22" height="22" rx="4" fill="#1f6b3f" />
        <path d="M4 16.5h16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        <path d="M7.5 16.5V11l4.5-3.5L16.5 11v5.5" stroke="#ffffff" strokeWidth="1.8" strokeLinejoin="round" fill="none" />
      </svg>
      <span className={`font-display font-bold tracking-[-0.02em] ${text}`}>Groundwork</span>
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  );
}
