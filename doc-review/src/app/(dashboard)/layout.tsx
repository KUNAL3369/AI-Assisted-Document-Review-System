'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '◻' },
  { href: '/upload', label: 'Upload', icon: '↑' },
  { href: '/review', label: 'Review Queue', icon: '☰' },
  { href: '/documents', label: 'Documents', icon: '📄' },
  { href: '/logs', label: 'Audit Logs', icon: '📋' },
  { href: '/team', label: 'Team', icon: '👥' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 bg-slate-800 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-bold tracking-tight">Doc Review</h2>
          <p className="text-xs text-slate-400 mt-0.5">AI-Assisted Review System</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-blue-500 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm bg-red-600 text-white hover:bg-red-700 transition-colors"
          >
            <span className="text-base">→</span>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
