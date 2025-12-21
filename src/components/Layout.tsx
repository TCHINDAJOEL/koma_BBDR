import { ReactNode, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Database,
  GitBranch,
  Table,
  AlertTriangle,
  Download,
  Upload,
  Menu,
  X,
  ChevronDown,
  FileArchive,
  FileSpreadsheet,
  FileCode,
  Sparkles
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const importMenuRef = useRef<HTMLDivElement>(null);

  // Handle scroll effect for header
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menus when clicking outside
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
    { href: '/validation', label: 'Validation', icon: AlertTriangle },
  ];

  const isActive = (href: string) => router.pathname === href;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-accent-400/15 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header - Glass Navigation */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-white/70 backdrop-blur-glass-lg border-b border-white/20 shadow-glass'
            : 'bg-transparent'
        }`}
      >
        <div className="page-container">
          <div className="flex items-center justify-between h-18 py-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:shadow-primary-500/50 transition-all duration-300 group-hover:scale-105">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent-400 rounded-full animate-pulse" />
              </div>
              <div className="hidden sm:block">
                <span className="text-xl font-bold bg-gradient-to-r from-dark-900 to-dark-700 bg-clip-text text-transparent">
                  Data
                </span>
                <span className="text-xl font-light text-primary-600 ml-1.5">Explore</span>
              </div>
            </Link>

            {/* Desktop Navigation - Pill Style */}
            <nav className="hidden md:flex items-center">
              <div className="flex items-center gap-1 p-1.5 bg-white/50 backdrop-blur-glass rounded-2xl border border-white/30 shadow-soft">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                        active
                          ? 'bg-white text-primary-600 shadow-md'
                          : 'text-dark-600 hover:text-dark-800 hover:bg-white/60'
                      }`}
                    >
                      <Icon size={18} className={active ? 'text-primary-500' : ''} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
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
                  className="btn btn-secondary gap-2"
                >
                  <Upload size={18} />
                  <span>Import</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-300 ${importMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {importMenuOpen && (
                  <div className="absolute right-0 mt-3 w-64 bg-white/95 backdrop-blur-glass-lg rounded-2xl border border-white/30 shadow-luxury py-2 animate-scale-in overflow-hidden">
                    <div className="px-4 py-2 border-b border-dark-100/50">
                      <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Importer des données</p>
                    </div>
                    <button
                      onClick={() => {
                        router.push('/import');
                        setImportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                        <FileArchive size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-dark-800">Archive</div>
                        <div className="text-xs text-dark-500">ZIP, TAR, TAR.GZ</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        router.push('/import-excel');
                        setImportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-emerald-50/50 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                        <FileSpreadsheet size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-dark-800">Excel</div>
                        <div className="text-xs text-dark-500">XLSX, XLS</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        router.push('/import-sql');
                        setImportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50/50 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                        <FileCode size={20} className="text-amber-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-dark-800">SQL</div>
                        <div className="text-xs text-dark-500">INSERT statements</div>
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
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-300 ${exportMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 mt-3 w-64 bg-white/95 backdrop-blur-glass-lg rounded-2xl border border-white/30 shadow-luxury py-2 animate-scale-in overflow-hidden">
                    <div className="px-4 py-2 border-b border-dark-100/50">
                      <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Exporter les données</p>
                    </div>
                    <button
                      onClick={() => {
                        window.open('/api/export', '_blank');
                        setExportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-primary-50/50 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                        <FileArchive size={20} className="text-primary-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-dark-800">Archive ZIP</div>
                        <div className="text-xs text-dark-500">Toutes les données</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        window.open('/api/export-excel', '_blank');
                        setExportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-emerald-50/50 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                        <FileSpreadsheet size={20} className="text-emerald-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-dark-800">Excel XLSX</div>
                        <div className="text-xs text-dark-500">Format stylisé</div>
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        window.open('/api/export-sql', '_blank');
                        setExportMenuOpen(false);
                      }}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50/50 transition-all duration-200 text-left group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                        <FileCode size={20} className="text-amber-600" />
                      </div>
                      <div>
                        <div className="font-semibold text-dark-800">SQL</div>
                        <div className="text-xs text-dark-500">Tables + Données</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2.5 bg-white/50 backdrop-blur-sm text-dark-600 hover:bg-white/80 rounded-xl border border-white/30 transition-all duration-300"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-glass-lg border-t border-white/20 animate-slide-down">
            <div className="page-container py-6 space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                      active
                        ? 'bg-primary-50 text-primary-600 shadow-sm'
                        : 'text-dark-600 hover:bg-dark-50'
                    }`}
                  >
                    <Icon size={22} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              })}

              <div className="pt-4 mt-4 border-t border-dark-100/50 space-y-4">
                <div>
                  <p className="px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Import</p>
                  <button
                    onClick={() => {
                      router.push('/import');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-dark-600 hover:bg-dark-50 transition-all"
                  >
                    <FileArchive size={20} />
                    <span className="font-medium">Import Archive</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/import-excel');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-dark-600 hover:bg-dark-50 transition-all"
                  >
                    <FileSpreadsheet size={20} />
                    <span className="font-medium">Import Excel</span>
                  </button>
                  <button
                    onClick={() => {
                      router.push('/import-sql');
                      setMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-dark-600 hover:bg-dark-50 transition-all"
                  >
                    <FileCode size={20} />
                    <span className="font-medium">Import SQL</span>
                  </button>
                </div>
                <div>
                  <p className="px-4 text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Export</p>
                  <button
                    onClick={() => window.open('/api/export', '_blank')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-dark-600 hover:bg-dark-50 transition-all"
                  >
                    <FileArchive size={20} />
                    <span className="font-medium">Export Archive</span>
                  </button>
                  <button
                    onClick={() => window.open('/api/export-excel', '_blank')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-dark-600 hover:bg-dark-50 transition-all"
                  >
                    <FileSpreadsheet size={20} />
                    <span className="font-medium">Export Excel</span>
                  </button>
                  <button
                    onClick={() => window.open('/api/export-sql', '_blank')}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-dark-600 hover:bg-dark-50 transition-all"
                  >
                    <FileCode size={20} />
                    <span className="font-medium">Export SQL</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-24">
        <div className="page-container py-8">
          {children}
        </div>
      </main>

      {/* Footer - Glass Style */}
      <footer className="relative mt-auto">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-dark-900/95 to-dark-950" />

        <div className="relative bg-dark-950/90 backdrop-blur-glass-lg border-t border-white/5">
          <div className="page-container py-16">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
              {/* Brand */}
              <div className="md:col-span-1">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-white">Data</span>
                    <span className="text-2xl font-light text-primary-400 ml-1">Explore</span>
                  </div>
                </div>
                <p className="text-dark-400 text-sm leading-relaxed">
                  Explorateur de données avec validation intelligente, modélisation de schéma et génération SQL.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <Sparkles size={16} className="text-accent-400" />
                  <span className="text-xs text-dark-500">Powered by AI</span>
                </div>
              </div>

              {/* Navigation */}
              <div>
                <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Navigation</h4>
                <ul className="space-y-3">
                  {navItems.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-dark-400 hover:text-white transition-colors duration-300 text-sm flex items-center gap-2 group"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-dark-600 group-hover:bg-primary-500 transition-colors" />
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Features */}
              <div>
                <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Features</h4>
                <ul className="space-y-3 text-sm text-dark-400">
                  {['Schema Modeling', 'ER Diagrams', 'Data Enrichment', 'SQL Generation', 'Validation Rules'].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-dark-600" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quick Actions */}
              <div>
                <h4 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Actions</h4>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/import')}
                    className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors duration-300 text-sm group"
                  >
                    <FileArchive size={16} className="group-hover:text-primary-400 transition-colors" />
                    <span>Import Archive</span>
                  </button>
                  <button
                    onClick={() => router.push('/import-excel')}
                    className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors duration-300 text-sm group"
                  >
                    <FileSpreadsheet size={16} className="group-hover:text-emerald-400 transition-colors" />
                    <span>Import Excel</span>
                  </button>
                  <button
                    onClick={() => window.open('/api/export', '_blank')}
                    className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors duration-300 text-sm group"
                  >
                    <Download size={16} className="group-hover:text-primary-400 transition-colors" />
                    <span>Export Archive</span>
                  </button>
                  <button
                    onClick={() => window.open('/api/export-excel', '_blank')}
                    className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors duration-300 text-sm group"
                  >
                    <Download size={16} className="group-hover:text-emerald-400 transition-colors" />
                    <span>Export Excel</span>
                  </button>
                  <button
                    onClick={() => window.open('/api/export-sql', '_blank')}
                    className="flex items-center gap-2 text-dark-400 hover:text-white transition-colors duration-300 text-sm group"
                  >
                    <FileCode size={16} className="group-hover:text-amber-400 transition-colors" />
                    <span>Export SQL</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-dark-500 text-sm">
                &copy; {new Date().getFullYear()} Data Explore. Tous droits réservés.
              </p>
              <div className="flex items-center gap-6 text-sm text-dark-500">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Built with Next.js
                </span>
                <span>Powered by React</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
