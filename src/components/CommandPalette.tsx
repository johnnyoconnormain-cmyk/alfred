'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchAction } from '@/actions/search';
import type { SearchHit } from '@/lib/queries/search';
import { money } from '@/lib/money';

interface Command {
  label: string;
  hint: string;
  href: string;
  keywords: string;
}

const COMMANDS: Command[] = [
  { label: 'New lead', hint: 'N', href: '/leads/new', keywords: 'create lead inquiry request' },
  { label: 'New quote', hint: 'Q', href: '/quotes/new', keywords: 'create quote estimate price' },
  { label: 'New customer', hint: 'C', href: '/customers/new', keywords: 'create customer contact' },
  { label: 'New job', hint: 'J', href: '/jobs/new', keywords: 'create job work order' },
  { label: "Today's jobs", hint: '', href: '/schedule', keywords: 'schedule calendar today crew' },
  { label: 'Find unpaid invoices', hint: '', href: '/payments?status=outstanding', keywords: 'money owed outstanding overdue invoice' },
  { label: 'Open analytics', hint: '', href: '/analytics', keywords: 'revenue reports numbers performance' },
  { label: 'Lead inbox', hint: '', href: '/leads', keywords: 'inbox leads new requests' },
  { label: 'Automations', hint: '', href: '/automations', keywords: 'follow up workflows sequences' },
  { label: 'Go to settings', hint: '', href: '/settings', keywords: 'pricing rates hours crew configuration' },
];

const TYPE_LABEL: Record<SearchHit['type'], string> = {
  customer: 'Customer',
  lead: 'Lead',
  quote: 'Quote',
  job: 'Job',
  invoice: 'Invoice',
};

/**
 * ⌘K palette and global search in one surface.
 *
 * Commands match instantly on the client; record results come from the server as
 * you type. Both lists share one keyboard cursor so Enter always does the
 * obvious thing.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const commands = COMMANDS.filter((c) => {
    if (!term.trim()) return true;
    const t = term.toLowerCase();
    return c.label.toLowerCase().includes(t) || c.keywords.includes(t);
  }).slice(0, 6);

  const items: { key: string; href: string; primary: string; secondary: string; tag: string; amount: number | null }[] = [
    ...commands.map((c) => ({
      key: `cmd:${c.href}`,
      href: c.href,
      primary: c.label,
      secondary: '',
      tag: c.hint || 'Action',
      amount: null,
    })),
    ...hits.map((h) => ({
      key: `${h.type}:${h.id}`,
      href: h.href,
      primary: h.title,
      secondary: h.subtitle,
      tag: TYPE_LABEL[h.type],
      amount: h.amount,
    })),
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      // Single-key shortcuts, only when nothing is focused for typing.
      const shortcuts: Record<string, string> = {
        n: '/leads/new',
        q: '/quotes/new',
        j: '/jobs/new',
        c: '/customers/new',
      };
      const href = shortcuts[e.key.toLowerCase()];
      if (href) {
        e.preventDefault();
        router.push(href);
      }
      if (e.key === '/') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  useEffect(() => {
    if (open) {
      setCursor(0);
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
    setTerm('');
    setHits([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const value = term.trim();
    if (value.length < 2) {
      setHits([]);
      return;
    }
    const ticket = ++seq.current;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const results = await searchAction(value);
        // Drop responses that arrive after a newer keystroke.
        if (ticket === seq.current) setHits(results);
      });
    }, 140);
    return () => clearTimeout(timer);
  }, [term, open]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[cursor];
      if (item) go(item.href);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded border border-line-strong bg-paper-raised px-3 py-1.5 text-sm text-ink-faint transition-colors hover:border-ink-faint sm:w-64"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="flex-1 text-left">Search or jump to…</span>
        <kbd className="hidden rounded border border-line px-1 text-2xs font-semibold text-ink-faint sm:block">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 px-4 pt-[12vh]"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl animate-scale-in overflow-hidden rounded-lg border border-line bg-paper-raised shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-line px-4">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="text-ink-faint">
                <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => {
                  setTerm(e.target.value);
                  setCursor(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Search customers, jobs, quotes, invoices — or type a command"
                className="w-full bg-transparent py-3.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
                aria-label="Search"
              />
            </div>

            <ul className="max-h-[52vh] overflow-y-auto py-1.5">
              {items.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-ink-faint">
                  Nothing matches “{term}”.
                </li>
              ) : null}
              {items.map((item, i) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(item.href)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === cursor ? 'bg-paper-sunken' : ''
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{item.primary}</span>
                      {item.secondary ? (
                        <span className="block truncate text-xs text-ink-faint">{item.secondary}</span>
                      ) : null}
                    </span>
                    {item.amount != null ? (
                      <span className="shrink-0 text-sm tabular text-ink-muted">{money(item.amount)}</span>
                    ) : null}
                    <span className="badge badge-neutral shrink-0">{item.tag}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-2xs text-ink-faint">
              <span>↑↓ to move</span>
              <span>↵ to open</span>
              <span>esc to close</span>
              <span className="ml-auto">N / Q / J / C create records</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
