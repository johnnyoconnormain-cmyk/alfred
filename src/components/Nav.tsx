'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  badge?: number;
}

const ICONS = {
  hud: 'M3 12h4l2.5-6 3 12 2.5-6h4',
  inbox: 'M3 12h4l1.5 3h7l1.5-3h4M3 12l2.5-7h13L21 12v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  quote: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
  calendar: 'M4 6h16v14H4zM4 10h16M9 3v4M15 3v4',
  job: 'M4 8h16v12H4zM9 8V5h6v3M4 13h16',
  people: 'M4 20c0-3 2.7-5 6-5s6 2 6 5M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M17 14c2 .5 3 2 3 4',
  money: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 9h.01M18 15h.01',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
  star: 'm12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8z',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.7 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  truck: 'M3 16V6h11v10M14 10h4l3 3v3h-7M6.5 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6M17.5 19a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6',
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">
      <path
        d={ICONS[name]}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded px-2.5 py-2 text-sm font-medium transition-colors ${
              active
                ? 'bg-field-light text-field-deep'
                : 'text-ink-muted hover:bg-paper-sunken hover:text-ink'
            }`}
          >
            <Icon name={item.icon} />
            <span className="flex-1 truncate">{item.label}</span>
            {item.badge ? (
              <span className="rounded-sm bg-status-serious px-1.5 py-px text-2xs font-bold text-white tabular">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: five destinations in the thumb zone, the rest behind “More”. */
export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const primary = items.slice(0, 4);
  const rest = items.slice(4);

  return (
    <>
      {more ? (
        <div
          className="fixed inset-0 z-40 bg-ink/25 lg:hidden"
          onClick={() => setMore(false)}
          role="presentation"
        >
          <div
            className="absolute inset-x-0 bottom-[60px] animate-fade-up border-t border-line bg-paper-raised p-3 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-3 gap-2">
              {rest.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMore(false)}
                  className="tap flex flex-col items-center justify-center gap-1.5 rounded border border-line px-2 py-3 text-xs font-medium text-ink-muted"
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper-raised lg:hidden">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`tap flex flex-1 flex-col items-center justify-center gap-1 py-2 text-2xs font-semibold tracking-normal ${
                active ? 'text-field' : 'text-ink-faint'
              }`}
            >
              <span className="relative">
                <Icon name={item.icon} />
                {item.badge ? (
                  <span className="absolute -right-2 -top-1 rounded-full bg-status-serious px-1 text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </span>
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className={`tap flex flex-1 flex-col items-center justify-center gap-1 py-2 text-2xs font-semibold ${
            more ? 'text-field' : 'text-ink-faint'
          }`}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
          </svg>
          More
        </button>
      </nav>
    </>
  );
}

export function NewMenu() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/leads/new', label: 'Lead', hint: 'N' },
    { href: '/customers/new', label: 'Customer', hint: 'C' },
    { href: '/quotes/new', label: 'Quote', hint: 'Q' },
    { href: '/jobs/new', label: 'Job', hint: 'J' },
    { href: '/payments/new', label: 'Invoice', hint: '' },
  ];

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn btn-primary btn-sm sm:px-3 sm:py-2 sm:text-sm">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        New
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} role="presentation" />
          <div className="absolute right-0 z-40 mt-1.5 w-44 animate-scale-in overflow-hidden rounded border border-line bg-paper-raised py-1 shadow-pop">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between px-3 py-2 text-sm text-ink hover:bg-paper-sunken"
              >
                {link.label}
                {link.hint ? (
                  <kbd className="rounded border border-line px-1 text-2xs text-ink-faint">{link.hint}</kbd>
                ) : null}
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
