import { useState } from 'react';
import {
  LayoutDashboard, FolderKanban, Layers, Users, BarChart2,
  Settings, Terminal, Bell, Plus, ChevronRight
} from 'lucide-react';
import type { Page } from '../App';
import { useWorkspace } from '../data/workspace-context';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'epics', label: 'Epics', icon: Layers },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'stats', label: 'Analytics', icon: BarChart2 },
] as const;

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { currentUser } = useWorkspace();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className="hidden md:flex flex-col h-screen shrink-0 relative transition-all duration-300"
      style={{
        width: collapsed ? '64px' : '220px',
        background: 'linear-gradient(180deg, rgba(7,16,7,0.98) 0%, rgba(5,11,5,0.98) 100%)',
        borderRight: '1px solid rgba(121,255,102,0.14)',
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center shrink-0"
        style={{
          height: '60px',
          padding: collapsed ? '0 14px' : '0 16px',
          borderBottom: '1px solid rgba(121,255,102,0.12)',
          gap: '12px',
        }}
      >
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{
            width: '36px',
            height: '36px',
            background: 'rgba(12, 28, 12, 0.92)',
            border: '1px solid rgba(140,255,90,0.42)',
            boxShadow: '0 0 18px rgba(140,255,90,0.16)',
          }}
        >
          <Terminal size={16} style={{ color: '#8cff5a' }} />
        </div>
        {!collapsed && (
          <span className="matrix-title" style={{ color: '#e2ffd8', fontSize: '14px', fontWeight: 700 }}>
            SlaveCode
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {/* Create button */}
        <div className="mb-4 px-1">
          <button
            onClick={() => onNavigate('projects')}
            className="flex items-center gap-2.5 rounded-xl transition-all duration-200 hover:opacity-90 active:scale-95"
            style={{
              width: '100%',
              padding: collapsed ? '9px' : '9px 14px',
              background: 'linear-gradient(135deg, rgba(120,255,99,0.16) 0%, rgba(72,168,66,0.26) 100%)',
              border: '1px solid rgba(121,255,102,0.2)',
              justifyContent: collapsed ? 'center' : 'flex-start',
              boxShadow: '0 0 24px rgba(90,255,90,0.12)',
            }}
          >
            <Plus size={16} className="shrink-0" style={{ color: '#dfffd8' }} />
            {!collapsed && (
              <span className="matrix-title" style={{ color: '#dfffd8', fontSize: '12px', fontWeight: 600 }}>New Project</span>
            )}
          </button>
        </div>

        {/* Nav items */}
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = currentPage === id || (currentPage === 'kanban' && id === 'projects');
          return (
            <div key={id} className="relative">
              <button
                onClick={() => onNavigate(id as Page)}
                onMouseEnter={() => setHoveredItem(id)}
                onMouseLeave={() => setHoveredItem(null)}
                className="w-full flex items-center rounded-xl transition-all duration-150"
                style={{
                  padding: collapsed ? '10px' : '10px 12px',
                  gap: '10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive
                    ? 'linear-gradient(90deg, rgba(121,255,102,0.12) 0%, rgba(121,255,102,0.04) 100%)'
                    : hoveredItem === id
                    ? 'rgba(121,255,102,0.05)'
                    : 'transparent',
                  color: isActive ? '#9aff72' : '#7da574',
                }}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && (
                  <span className="matrix-title" style={{ fontSize: '12px', fontWeight: isActive ? 600 : 400, flex: 1, textAlign: 'left', letterSpacing: '0.08em' }}>
                    {label}
                  </span>
                )}
                {isActive && !collapsed && (
                  <div
                    className="rounded-full"
                    style={{ width: '5px', height: '5px', background: '#8cff5a' }}
                  />
                )}
              </button>

              {/* Tooltip on collapsed */}
              {collapsed && hoveredItem === id && (
                <div
                  className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
                  style={{
                    background: '#0d180d',
                    border: '1px solid rgba(121,255,102,0.14)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#d7f7d1',
                    fontSize: '12px',
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  }}
                >
                  {label}
                </div>
              )}

              {/* Active indicator bar */}
              {isActive && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{ width: '3px', height: '20px', background: '#8cff5a' }}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div
        className="px-2 pb-4 space-y-1 shrink-0"
        style={{ borderTop: '1px solid rgba(121,255,102,0.12)', paddingTop: '12px', marginTop: '4px' }}
      >
        {/* Notifications */}
        <button
          className="w-full flex items-center rounded-xl transition-all hover:bg-white/5"
          style={{
            padding: collapsed ? '10px' : '10px 12px',
            gap: '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#89bd80',
            position: 'relative',
          }}
        >
          <Bell size={17} className="shrink-0" />
          {!collapsed && <span style={{ fontSize: '13px' }}>Notifications</span>}
          <span
            className="absolute flex items-center justify-center rounded-full text-white"
            style={{
              width: '16px',
              height: '16px',
              background: '#173017',
              border: '1px solid rgba(121,255,102,0.18)',
              color: '#8cff5a',
              fontSize: '9px',
              fontWeight: 700,
              top: '8px',
              left: collapsed ? '22px' : undefined,
              right: collapsed ? undefined : '10px',
            }}
          >
            {currentUser ? 0 : 0}
          </span>
        </button>

        {/* Settings */}
        <button
          onClick={() => onNavigate('settings')}
          className="w-full flex items-center rounded-xl transition-all hover:bg-white/5"
          style={{
            padding: collapsed ? '10px' : '10px 12px',
            gap: '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: currentPage === 'settings' ? '#9aff72' : '#89bd80',
          }}
        >
          <Settings size={17} className="shrink-0" />
          {!collapsed && <span style={{ fontSize: '13px' }}>Settings</span>}
        </button>

        {/* Expand/Collapse */}
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center rounded-xl transition-all hover:bg-white/5"
          style={{
            padding: collapsed ? '10px' : '10px 12px',
            gap: '10px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: '#5e7f58',
          }}
        >
          <ChevronRight
            size={15}
            className="shrink-0 transition-transform"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
          />
          {!collapsed && <span style={{ fontSize: '12px' }}>Collapse</span>}
        </button>

        {/* User */}
        <div
          className="flex items-center gap-3 rounded-xl px-2 py-2.5 cursor-pointer transition-all hover:bg-white/5 mt-2"
          style={{ marginTop: '4px' }}
        >
          <div
            className="flex items-center justify-center rounded-full text-white shrink-0"
            style={{
              width: '32px',
              height: '32px',
              background: currentUser?.color || '#3f5a3f',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: `0 0 14px ${currentUser?.color || '#3f5a3f'}50`,
            }}
          >
            {currentUser?.initials || 'U'}
          </div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#dfffd8', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentUser?.name || 'Workspace User'}
              </div>
              <div className="matrix-title" style={{ color: '#5e7f58', fontSize: '10px', letterSpacing: '0.08em' }}>{currentUser?.role || 'Member'}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
