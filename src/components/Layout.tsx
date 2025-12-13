import { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Database, GitBranch, Table, History, AlertTriangle, Download, Upload } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();

  const navItems = [
    { href: '/', label: 'Schema Explorer', icon: Database },
    { href: '/diagram', label: 'ER Diagram', icon: GitBranch },
    { href: '/data', label: 'Data Enrichment', icon: Table },
    { href: '/audit', label: 'Audit Log', icon: History },
    { href: '/validation', label: 'Validation', icon: AlertTriangle },
  ];

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">KOMA BBDR</h1>
            <p className="text-sm text-gray-400">Data Catalog & Schema Modeling Tool</p>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="w-64 bg-gray-800 text-white p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-8 pt-8 border-t border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => router.push('/import')}
                className="flex items-center space-x-3 px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 w-full"
              >
                <Upload size={18} />
                <span>Import ZIP</span>
              </button>
              <button
                onClick={() => window.open('/api/export', '_blank')}
                className="flex items-center space-x-3 px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-gray-700 w-full"
              >
                <Download size={18} />
                <span>Export ZIP</span>
              </button>
            </div>
          </div>
        </nav>

        <main className="flex-1 bg-gray-50 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
