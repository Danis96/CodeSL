import { useEffect, useState } from 'react';
import { Camera, Moon, Bell, LogOut, Shield, Trash2, Check, Mail } from 'lucide-react';
import { useWorkspace } from '../data/workspace-context';
import GitHubIntegrationCard from './github-integration-card';

const notifs = [
  { id: 'n1', label: 'Task assigned to me', desc: 'When someone assigns a task to you', on: true },
  { id: 'n2', label: 'Task status updates', desc: 'When your tasks change status', on: true },
  { id: 'n3', label: 'Comments on tasks', desc: 'When someone comments on your tasks', on: true },
  { id: 'n4', label: 'New member joins', desc: 'When a new member joins the workspace', on: false },
  { id: 'n5', label: 'Weekly digest', desc: 'Summary of your weekly activity', on: false },
  { id: 'n6', label: 'Project deadlines', desc: 'Reminders about upcoming deadlines', on: true },
];

export default function SettingsPage() {
  const { currentUser, logout, updateCurrentUserProfile, resetPassword } = useWorkspace();
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [notifStates, setNotifStates] = useState<Record<string, boolean>>(Object.fromEntries(notifs.map((n) => [n.id, n.on])));
  const [saved, setSaved] = useState(false);
  const [passwordSending, setPasswordSending] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ kind: 'idle' | 'success' | 'error'; text: string }>({ kind: 'idle', text: '' });

  useEffect(() => {
    setName(currentUser?.name || '');
    setEmail(currentUser?.email || '');
  }, [currentUser]);

  const handleSave = async () => {
    await updateCurrentUserProfile({ name, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setPasswordStatus({ kind: 'error', text: 'Email required before sending reset link.' });
      return;
    }

    setPasswordSending(true);
    setPasswordStatus({ kind: 'idle', text: '' });

    try {
      await resetPassword(email.trim());
      setPasswordStatus({ kind: 'success', text: `Reset link sent to ${email.trim()}.` });
    } catch (error) {
      console.error(error);
      setPasswordStatus({ kind: 'error', text: 'Password reset email failed. Check email value and Firebase auth config.' });
    } finally {
      setPasswordSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '18px', fontWeight: 800, letterSpacing: '0.08em' }}>SETTINGS</h1>
          <p className="matrix-muted" style={{ fontSize: '12px' }}>Manage your account and preferences</p>
        </div>
        <button onClick={() => void handleSave()} className="ml-auto flex items-center gap-2 rounded-xl px-4 transition-all hover:opacity-90 active:scale-95" style={{ background: saved ? 'rgba(116,255,125,0.14)' : 'linear-gradient(135deg, rgba(120,255,99,0.16), rgba(72,168,66,0.26))', border: '1px solid rgba(121,255,102,0.18)', color: saved ? '#74ff7d' : '#e8ffe1', fontSize: '13px', fontWeight: 600, height: '38px', boxShadow: saved ? 'none' : '0 0 24px rgba(90,255,90,0.12)' }}>
          {saved ? <><Check size={13} />Saved!</> : 'Save Changes'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
        <div className="max-w-2xl space-y-5">
          <div className="matrix-panel rounded-2xl p-6">
            <h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700, marginBottom: '20px' }}>Profile</h2>
            <div className="flex items-start gap-5 mb-5">
              <div className="relative shrink-0">
                <div className="flex items-center justify-center rounded-full text-white" style={{ width: '70px', height: '70px', background: currentUser?.color || '#3f5a3f', fontSize: '22px', fontWeight: 800, boxShadow: `0 0 20px ${currentUser?.color || '#3f5a3f'}50` }}>
                  {currentUser?.initials || 'U'}
                </div>
                <button className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full" style={{ width: '24px', height: '24px', background: '#173017', border: '2px solid #0a140a', color: '#8cff5a' }}>
                  <Camera size={10} />
                </button>
              </div>
              <div>
                <div style={{ color: '#ebffe5', fontSize: '16px', fontWeight: 700 }}>{currentUser?.name || 'Workspace User'}</div>
                <div className="matrix-muted" style={{ fontSize: '13px' }}>{currentUser?.email || 'No email'}</div>
                <span className="inline-block rounded-full px-2.5 py-0.5 mt-1" style={{ background: 'rgba(121,255,102,0.12)', color: '#8cff5a', fontSize: '10px', fontWeight: 700 }}>{currentUser?.role || 'Member'}</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[{ label: 'Full Name', val: name, set: setName, type: 'text' }, { label: 'Email', val: email, set: setEmail, type: 'email' }].map(({ label, val, set, type }) => (
                <div key={label}>
                  <label className="matrix-title block mb-1.5" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>{label}</label>
                  <input value={val} onChange={(e) => set(e.target.value)} type={type} className="w-full rounded-xl px-4 py-3 outline-none transition-all" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#e2ffd8', fontSize: '14px' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(140,255,90,0.4)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(121,255,102,0.12)')} />
                </div>
              ))}
            </div>
          </div>

          <div className="matrix-panel rounded-2xl p-6">
            <h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Appearance</h2>
            <div className="rounded-2xl p-5 flex items-center justify-between" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.14)' }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-2xl" style={{ width: '42px', height: '42px', background: 'rgba(121,255,102,0.1)', color: '#8cff5a' }}>
                  <Moon size={18} />
                </div>
                <div>
                  <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '11px', fontWeight: 700 }}>Dark</div>
                  <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '4px' }}>Only supported theme in current matrix shell.</div>
                </div>
              </div>
              <div className="rounded-full flex items-center justify-center" style={{ width: '18px', height: '18px', background: '#173017', border: '1px solid rgba(121,255,102,0.18)' }}>
                <Check size={10} style={{ color: '#8cff5a' }} />
              </div>
            </div>
          </div>

          <div className="matrix-panel rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={15} style={{ color: '#8cff5a' }} />
              <h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Notifications</h2>
            </div>
            <div className="space-y-0.5">
              {notifs.map((n) => (
                <div key={n.id} className="flex items-center justify-between py-3 px-1" style={{ borderBottom: '1px solid rgba(121,255,102,0.06)' }}>
                  <div>
                    <div style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 500 }}>{n.label}</div>
                    <div className="matrix-muted" style={{ fontSize: '11px' }}>{n.desc}</div>
                  </div>
                  <button onClick={() => setNotifStates((p) => ({ ...p, [n.id]: !p[n.id] }))} className="rounded-full transition-all" style={{ width: '42px', height: '23px', background: notifStates[n.id] ? '#173017' : 'rgba(121,255,102,0.08)', border: '1px solid rgba(121,255,102,0.12)', position: 'relative', flexShrink: 0 }}>
                    <div className="absolute top-1 rounded-full transition-all" style={{ width: '15px', height: '15px', left: notifStates[n.id] ? '23px' : '4px', background: notifStates[n.id] ? '#8cff5a' : '#5e7f58' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="matrix-panel rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4"><Shield size={15} style={{ color: '#62ffbf' }} /><h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Security</h2></div>
            <div className="space-y-3">
              <button onClick={() => void handlePasswordReset()} className="w-full flex items-center justify-between rounded-xl px-4 py-3 transition-all hover:opacity-80" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                <span className="flex items-center gap-2" style={{ color: '#ebffe5', fontSize: '13px' }}>
                  <Mail size={13} style={{ color: '#8cff5a' }} />
                  {passwordSending ? 'Sending reset link...' : 'Send password reset email'}
                </span>
                <span className="matrix-muted" style={{ fontSize: '12px' }}>→</span>
              </button>
              {passwordStatus.text && (
                <div style={{ color: passwordStatus.kind === 'success' ? '#8cff5a' : '#c5ff62', fontSize: '12px' }}>
                  {passwordStatus.text}
                </div>
              )}
              <div className="w-full flex items-center justify-between rounded-xl px-4 py-3" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                <span style={{ color: '#ebffe5', fontSize: '13px' }}>Two-Factor Authentication</span>
                <span className="rounded-full px-2 py-0.5" style={{ background: 'rgba(120,247,184,0.12)', color: '#78f7b8', fontSize: '10px', fontWeight: 700 }}>Disabled</span>
              </div>
            </div>
          </div>

          <GitHubIntegrationCard />

          <div className="matrix-panel rounded-2xl p-6" style={{ borderColor: 'rgba(121,255,102,0.12)' }}>
            <h2 className="matrix-title" style={{ color: '#8cff5a', fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Session Controls</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => void logout()} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-all hover:opacity-80" style={{ background: 'rgba(8,18,8,0.88)', border: '1px solid rgba(121,255,102,0.12)', color: '#89bd80', fontSize: '14px' }}>
                <LogOut size={14} />Sign Out
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-all hover:opacity-80" style={{ background: 'rgba(121,255,102,0.08)', border: '1px solid rgba(121,255,102,0.14)', color: '#8cff5a', fontSize: '14px' }}>
                <Trash2 size={14} />Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
