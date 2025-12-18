import { ReactNode, useState, useRef, useEffect } from 'react';
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
  ExternalLink,
  FileArchive,
  FileSpreadsheet
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);

  // Fermer les menus quand on clique ailleurs
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
      if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
        setImportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
              <div className="hidden sm:block">
                <span className="text-lg font-bold text-dark-900">Visualisateur</span>
                <span className="text-lg font-light text-primary-600 ml-1">BDD</span>
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
              {/* Import Dropdown */}
              <div className="relative" ref={importMenuRef}>
                <button
                  onClick={() => {
                    setImportMenuOpen(!importMenuOpen);
                    setExportMenuOpen(false);
                  }}
                  className="btn btn-ghost gap-2"
                >
                  <Upload size={18} />
                  <span>Import</span>
                  <ChevronDown size={16} className={`transition-transform ${importMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {importMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-dark-100 py-2 animate-fade-in z-50">
                    <button
                      onClick={() => {
                        router.push('/import');
                        setImportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-50 transition-colors text-left"
                    >
                      <FileArchive size={20} className="text-primary-600" />
                      <div>
                        <div className="font-medium text-dark-900">Import Archive</div>
                        <div className="text-xs text-dark-500">ZIP, TAR, TAR.GZ...</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        router.push('/import-excel');
                        setImportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-50 transition-colors text-left"
                    >
                      <FileSpreadsheet size={20} className="text-green-600" />
                      <div>
                        <div className="font-medium text-dark-900">Import Excel</div>
                        <div className="text-xs text-dark-500">XLSX, XLS</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Export Dropdown */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  onClick={() => {
                    setExportMenuOpen(!exportMenuOpen);
                    setImportMenuOpen(false);
                  }}
                  className="btn btn-primary gap-2"
                >
                  <Download size={18} />
                  <span>Export</span>
                  <ChevronDown size={16} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-dark-100 py-2 animate-fade-in z-50">
                    <button
                      onClick={() => {
                        window.open('/api/export', '_blank');
                        setExportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-50 transition-colors text-left"
                    >
                      <FileArchive size={20} className="text-primary-600" />
                      <div>
                        <div className="font-medium text-dark-900">Export Archive</div>
                        <div className="text-xs text-dark-500">ZIP avec toutes les données</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        window.open('/api/export-excel', '_blank');
                        setExportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-dark-50 transition-colors text-left"
                    >
                      <FileSpreadsheet size={20} className="text-green-600" />
                      <div>
                        <div className="font-medium text-dark-900">Export Excel</div>
                        <div className="text-xs text-dark-500">XLSX stylisé</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
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
                <p className="px-3 text-xs font-semibold text-dark-500 uppercase tracking-wider">Import</p>
                <button
                  onClick={() => {
                    router.push('/import');
                    setMobileMenuOpen(false);
                  }}
                  className="sidebar-item w-full"
                >
                  <FileArchive size={20} />
                  <span>Import Archive</span>
                </button>
                <button
                  onClick={() => {
                    router.push('/import-excel');
                    setMobileMenuOpen(false);
                  }}
                  className="sidebar-item w-full"
                >
                  <FileSpreadsheet size={20} />
                  <span>Import Excel</span>
                </button>
                <p className="px-3 pt-2 text-xs font-semibold text-dark-500 uppercase tracking-wider">Export</p>
                <button
                  onClick={() => window.open('/api/export', '_blank')}
                  className="sidebar-item w-full"
                >
                  <FileArchive size={20} />
                  <span>Export Archive (ZIP)</span>
                </button>
                <button
                  onClick={() => window.open('/api/export-excel', '_blank')}
                  className="sidebar-item w-full"
                >
                  <FileSpreadsheet size={20} />
                  <span>Export Excel (XLSX)</span>
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
                  <span className="text-xl font-bold">Visualisateur</span>
                  <span className="text-xl font-light text-primary-400 ml-1">BDD</span>
                </div>
              </div>
              <p className="text-dark-400 text-sm">
                Visualisateur dynamique de base de données avec validation intelligente
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
                  <FileArchive size={16} />
                  <span>Import Archive</span>
                </button>
                <button
                  onClick={() => router.push('/import-excel')}
                  className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
                >
                  <FileSpreadsheet size={16} />
                  <span>Import Excel</span>
                </button>
                <button
                  onClick={() => window.open('/api/export', '_blank')}
                  className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
                >
                  <FileArchive size={16} />
                  <span>Export Archive (ZIP)</span>
                </button>
                <button
                  onClick={() => window.open('/api/export-excel', '_blank')}
                  className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors text-sm"
                >
                  <FileSpreadsheet size={16} />
                  <span>Export Excel (XLSX)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-dark-800 mt-8 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-dark-500 text-sm">
              &copy; {new Date().getFullYear()} Visualisateur BDD. Tous droits réservés.
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
