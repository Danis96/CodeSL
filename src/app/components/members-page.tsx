import { useState } from 'react';
import { UserPlus, Copy, Link, Mail, Shield, Eye, Crown, User, Check, ChevronDown } from 'lucide-react';
import type { MemberRole } from '../data/mock-data';
import { useWorkspace } from '../data/workspace-context';

const roleIcons: Record<MemberRole, React.ReactNode> = {
  Owner: <Crown size={11} />, Admin: <Shield size={11} />, Member: <User size={11} />, Viewer: <Eye size={11} />,
};

const roleColors: Record<MemberRole, { bg: string; text: string }> = {
  Owner: { bg: 'rgba(120,247,184,0.15)', text: '#78f7b8' },
  Admin: { bg: 'rgba(139,255,119,0.15)', text: '#8bff77' },
  Member: { bg: 'rgba(98,255,191,0.15)', text: '#62ffbf' },
  Viewer: { bg: 'rgba(121,255,102,0.1)', text: '#89bd80' },
};

export default function MembersPage() {
  const { members } = useWorkspace();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('Member');
  const [linkCopied, setLinkCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '18px', fontWeight: 800, letterSpacing: '0.08em' }}>MEMBERS</h1>
          <p className="matrix-muted" style={{ fontSize: '12px' }}>{members.length} members · Manage workspace access</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Member list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="matrix-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(121,255,102,0.08)' }}>
                <h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Workspace Members</h2>
              </div>
              {members.map((member, i) => {
                const rc = roleColors[member.role];
                return (
                  <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:opacity-80 transition-opacity" style={{ borderBottom: i < members.length - 1 ? '1px solid rgba(121,255,102,0.06)' : 'none' }}>
                    <div className="flex items-center justify-center rounded-full text-white shrink-0" style={{ width: '40px', height: '40px', background: member.color, fontSize: '13px', fontWeight: 700, boxShadow: `0 0 12px ${member.color}40` }}>
                      {member.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ color: '#ebffe5', fontSize: '14px', fontWeight: 600 }}>{member.name}</div>
                      <div className="matrix-muted" style={{ fontSize: '12px' }}>{member.email}</div>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: rc.bg, color: rc.text, fontSize: '11px', fontWeight: 600 }}>
                      {roleIcons[member.role]}{member.role}
                    </span>
                    <button className="flex items-center justify-center rounded-lg hover:opacity-80" style={{ width: '28px', height: '28px', background: 'rgba(121,255,102,0.06)', color: '#89bd80' }}>
                      <ChevronDown size={12} />
                    </button>
                    <span className="hidden md:block matrix-muted" style={{ fontSize: '11px', minWidth: '80px', textAlign: 'right' }}>Joined {member.joinedAt}</span>
                  </div>
                );
              })}
            </div>

            {/* Pending */}
            <div className="matrix-panel rounded-2xl overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(121,255,102,0.08)' }}>
                <h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Pending Invitations</h2>
                <span className="rounded-full px-2 py-0.5" style={{ background: 'rgba(120,247,184,0.15)', color: '#78f7b8', fontSize: '10px', fontWeight: 700 }}>0</span>
              </div>
              <div className="px-5 py-6 matrix-muted" style={{ fontSize: '12px' }}>
                Invite records not wired yet. Firestore-backed member list live above.
              </div>
            </div>
          </div>

          {/* Invite panel */}
          <div className="space-y-4">
            <div className="matrix-panel rounded-2xl p-5">
              <h3 className="matrix-title mb-4 flex items-center gap-2" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>
                <UserPlus size={15} style={{ color: '#8cff5a' }} />Invite Member
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="matrix-title" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>Email</label>
                  <div className="flex items-center gap-2 rounded-xl px-3 mt-1.5" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', height: '42px' }}>
                    <Mail size={13} style={{ color: '#5e7f58' }} />
                    <input type="email" placeholder="colleague@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="flex-1 bg-transparent outline-none" style={{ color: '#e2ffd8', fontSize: '13px' }} />
                  </div>
                </div>
                <div>
                  <label className="matrix-title" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>Role</label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {(['Admin', 'Member', 'Viewer'] as MemberRole[]).map((role) => {
                      const rc = roleColors[role];
                      return (
                        <button key={role} onClick={() => setInviteRole(role)} className="flex items-center gap-2 rounded-xl px-3 py-2.5 transition-all" style={{ background: inviteRole === role ? rc.bg : '#0b150b', border: `1px solid ${inviteRole === role ? rc.text + '40' : 'rgba(121,255,102,0.12)'}`, color: inviteRole === role ? rc.text : '#89bd80', fontSize: '12px', fontWeight: inviteRole === role ? 600 : 400 }}>
                          {roleIcons[role]}{role}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button onClick={() => { setEmailSent(true); setInviteEmail(''); setTimeout(() => setEmailSent(false), 2000); }} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 transition-all hover:opacity-90 active:scale-95" style={{ background: emailSent ? 'rgba(116,255,125,0.14)' : 'linear-gradient(135deg, rgba(120,255,99,0.16), rgba(72,168,66,0.26))', border: '1px solid rgba(121,255,102,0.18)', color: emailSent ? '#74ff7d' : '#e8ffe1', fontSize: '13px', fontWeight: 600, boxShadow: emailSent ? 'none' : '0 0 24px rgba(90,255,90,0.12)' }}>
                  {emailSent ? <><Check size={14} />Sent!</> : <><Mail size={14} />Send Invite</>}
                </button>
              </div>
            </div>

            <div className="matrix-panel rounded-2xl p-5">
              <h3 className="matrix-title mb-2 flex items-center gap-2" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>
                <Link size={14} style={{ color: '#62ffbf' }} />Invite Link
              </h3>
              <p className="matrix-muted" style={{ fontSize: '12px', marginBottom: '12px' }}>Share link to invite as Member.</p>
              <div className="flex items-center gap-2 rounded-xl px-3 mb-3" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', height: '38px' }}>
                <span className="flex-1 truncate matrix-muted" style={{ fontSize: '11px' }}>Invite link flow pending backend setup.</span>
              </div>
              <button onClick={() => { setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2000); }} className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 transition-all hover:opacity-80" style={{ background: linkCopied ? 'rgba(116,255,125,0.1)' : 'rgba(121,255,102,0.06)', border: '1px solid rgba(121,255,102,0.12)', color: linkCopied ? '#74ff7d' : '#ebffe5', fontSize: '13px' }}>
                {linkCopied ? <><Check size={13} />Copied!</> : <><Copy size={13} />Copy Link</>}
              </button>
            </div>

            <div className="matrix-panel rounded-2xl p-5">
              <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>Roles</h3>
              <div className="space-y-3">
                {[{ role: 'Owner', desc: 'Full access, billing, delete workspace' }, { role: 'Admin', desc: 'Manage members, projects, epics' }, { role: 'Member', desc: 'Create tasks, add comments' }, { role: 'Viewer', desc: 'View only, no editing' }].map(({ role, desc }) => {
                  const rc = roleColors[role as MemberRole];
                  return (
                    <div key={role} className="flex items-start gap-2.5">
                      <span className="flex items-center gap-1 rounded-full px-2 py-0.5 shrink-0 mt-0.5" style={{ background: rc.bg, color: rc.text, fontSize: '10px', fontWeight: 700 }}>{roleIcons[role as MemberRole]}{role}</span>
                      <span className="matrix-muted" style={{ fontSize: '12px' }}>{desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
