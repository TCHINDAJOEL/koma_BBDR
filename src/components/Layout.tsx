import { ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Database,
  GitBranch,
  Table,
  History,
  AlertTriangle,
  Download,
  Upload,
  Menu,
  X,
  ChevronDown,
  ExternalLink
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { href: '/', label: 'Schema', icon: Database },
    { href: '/diagram', label: 'Diagram', icon: GitBranch },
    { href: '/data', label: 'Data', icon: Table },
    { href: '/audit', label: 'Audit', icon: History },
    { href: '/validation', label: 'Validation', icon: AlertTriangle },
  ];

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="min-h-screen flex flex-col bg-dark-50">
      {/* Header */}
      <header className="bg-white border-b border-dark-100 sticky top-0 z-40">
        <div className="page-container">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-dark-900">KOMA</span>
                <span className="text-xl font-light text-primary-600 ml-1">BBDR</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link flex items-center gap-2 ${
                      isActive(item.href) ? 'nav-link-active' : ''
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => router.push('/import')}
                className="btn btn-ghost gap-2"
              >
                <Upload size={18} />
                <span>Import</span>
              </button>
              <button
                onClick={() => window.open('/api/export', '_blank')}
                className="btn btn-primary gap-2"
              >
                <Download size={18} />
                <span>Export</span>
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-dark-600 hover:bg-dark-100 rounded-lg"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-100 bg-white animate-fade-in">
            <div className="page-container py-4 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`sidebar-item ${
                      isActive(item.href) ? 'sidebar-item-active' : ''
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="pt-4 border-t border-dark-100 space-y-2">
                <button
                  onClick={() => {
                    router.push('/import');
                    setMobileMenuOpen(false);
                  }}
                  className="sidebar-item w-full"
                >
                  <Upload size={20} />
                  <span>Import ZIP</span>
                </button>
                <button
                  onClick={() => window.open('/api/export', '_blank')}
                  className="sidebar-item w-full"
                >
                  <Download size={20} />
                  <span>Export ZIP</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="page-container py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-dark-900 text-white">
        <div className="page-container py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xl font-bold">KOMA</span>
                  <span className="text-xl font-light text-primary-400 ml-1">BBDR</span>
                </div>
              </div>
              <p className="text-dark-400 text-sm">
                Data Catalog & Schema Modeling Tool with intelligent validation
              </p>
            </div>

            {/* Navigation */}
            <div>
              <h4 className="font-semibold text-white mb-4">Navigation</h4>
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-dark-400 hover:text-white transition-colors text-sm"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Features */}
            <div>
              <h4 className="font-semibold text-white mb-4">Features</h4>
              <ul className="space-y-2 text-sm text-dark-400">
                <li>Schema Modeling</li>
                <li>ER Diagrams</li>
                <li>Data Enrichment</li>
                <li>Validation Rules</li>
                <li>Audit Logging</li>
              </ul>
            </div>

            {/* Actions */}
            <div>
              <h4 className="font-semibold text-white mb-4">Quick Actions</h4>
              <div className="space-y-3">
                <button
                  onClick={() => router.push('/import')}
                  className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
                >
                  <Upload size={16} />
                  <span>Import Project</span>
                </button>
                <button
                  onClick={() => window.open('/api/export', '_blank')}
                  className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
                >
                  <Download size={16} />
                  <span>Export Project</span>
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-dark-800 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-dark-500 text-sm">
              &copy; {new Date().getFullYear()} KOMA BBDR. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-dark-500">
              <span>Built with Next.js</span>
              <span className="w-1 h-1 bg-dark-600 rounded-full"></span>
              <span>Powered by React</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
