import { LayoutDashboard, FolderKanban, Layers, Users, BarChart2 } from 'lucide-react';
import type { Page } from '../App';

interface MobileNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'epics', label: 'Epics', icon: Layers },
  { id: 'members', label: 'Team', icon: Users },
  { id: 'stats', label: 'Stats', icon: BarChart2 },
] as const;

export default function MobileNav({ currentPage, onNavigate }: MobileNavProps) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        background: 'rgba(6, 13, 6, 0.94)',
        borderTop: '1px solid rgba(121,255,102,0.14)',
        backdropFilter: 'blur(14px)',
        height: '64px',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {navItems.map(({ id, label, icon: Icon }) => {
        const isActive = currentPage === id || (currentPage === 'kanban' && id === 'projects');
        return (
          <button
            key={id}
            onClick={() => onNavigate(id as Page)}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all"
            style={{ color: isActive ? '#9aff72' : '#5e7f58' }}
          >
            <Icon size={20} />
            <span className="matrix-title" style={{ fontSize: '9px', fontWeight: isActive ? 600 : 400, letterSpacing: '0.08em' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
