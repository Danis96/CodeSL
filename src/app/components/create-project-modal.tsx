import { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import type { Priority } from '../data/mock-data';
import { useWorkspace } from '../data/workspace-context';

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const gradients = [
  { from: '#8cff5a', to: '#4ca843', label: 'Terminal', code: 'MX-01' },
  { from: '#62ffbf', to: '#159f73', label: 'Signal', code: 'MX-02' },
  { from: '#8bff77', to: '#2f7a42', label: 'Static', code: 'MX-03' },
  { from: '#dfff69', to: '#5ea63a', label: 'Phosphor', code: 'MX-04' },
  { from: '#78f7b8', to: '#2f9158', label: 'Cascade', code: 'MX-05' },
  { from: '#74ff7d', to: '#2f6f35', label: 'Kernel', code: 'MX-06' },
];

export default function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const { createProject } = useWorkspace();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [dueDate, setDueDate] = useState('2026-07-31');
  const [priority, setPriority] = useState<Priority>('High');
  const [selectedGradient, setSelectedGradient] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const g = gradients[selectedGradient];

  const handleCreate = async () => {
    if (!name.trim()) return;
    setError('');
    setLoading(true);
    try {
      await createProject({
        title: name.trim(),
        description: description.trim(),
        startDate,
        dueDate,
        priority,
        gradientFrom: g.from,
        gradientTo: g.to,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Project creation failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(12px)' }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="matrix-panel w-full overflow-hidden" style={{ maxWidth: '500px', borderRadius: '20px', boxShadow: '0 40px 100px rgba(0,0,0,0.7)' }}>
        {/* Gradient preview */}
        <div className="relative h-28 flex items-end px-6 pb-5 overflow-hidden" style={{ background: `linear-gradient(135deg, ${g.from} 0%, ${g.to} 100%)` }}>
          <div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 45%, rgba(4,16,4,0.22) 100%)' }} />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(6,18,6,0.32) 0px, rgba(6,18,6,0.32) 1px, transparent 1px, transparent 8px)' }} />
          <div className="absolute inset-y-0 right-0 w-40 opacity-30" style={{ background: 'radial-gradient(circle at 70% 30%, rgba(235,255,229,0.52) 0%, transparent 70%)' }} />
          <button onClick={onClose} className="absolute top-4 right-4 flex items-center justify-center rounded-xl hover:opacity-70 transition-opacity" style={{ width: '30px', height: '30px', background: 'rgba(4,16,4,0.42)', border: '1px solid rgba(121,255,102,0.18)', color: '#ebffe5' }}>
            <X size={14} />
          </button>
          <div className="relative z-10">
            <div className="matrix-kicker" style={{ color: 'rgba(6,18,6,0.6)', fontSize: '10px', marginBottom: '8px' }}>
              [{g.code}] theme.channel
            </div>
            <h2 className="matrix-title" style={{ color: 'rgba(235,255,229,0.92)', fontSize: '16px', fontWeight: 700, textShadow: '0 0 18px rgba(235,255,229,0.18)' }}>
              {name || <span style={{ opacity: 0.5 }}>Project Name</span>}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Gradient selector */}
          <div>
            <label className="matrix-title" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>Color Theme</label>
            <div className="grid grid-cols-2 gap-3 mt-3 sm:grid-cols-3">
              {gradients.map((gr, i) => (
                <button
                  key={gr.code}
                  onClick={() => setSelectedGradient(i)}
                  className="relative overflow-hidden rounded-2xl p-3 text-left transition-all hover:translate-y-[-1px]"
                  style={{
                    background: selectedGradient === i ? 'linear-gradient(180deg, rgba(15,30,15,0.96) 0%, rgba(9,18,9,0.98) 100%)' : 'linear-gradient(180deg, rgba(10,20,10,0.82) 0%, rgba(8,15,8,0.96) 100%)',
                    border: `1px solid ${selectedGradient === i ? 'rgba(215,247,209,0.42)' : 'rgba(121,255,102,0.12)'}`,
                    boxShadow: selectedGradient === i ? `0 0 0 1px rgba(140,255,90,0.08), 0 0 28px ${gr.from}30` : 'none',
                  }}
                >
                  <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(180deg, rgba(121,255,102,0.1) 0px, rgba(121,255,102,0.1) 1px, transparent 1px, transparent 7px)' }} />
                  <div className="relative z-10">
                    <div className="mb-3 flex items-center justify-between">
                      <div
                        className="rounded-xl"
                        style={{
                          width: '42px',
                          height: '42px',
                          background: `linear-gradient(135deg, ${gr.from}, ${gr.to})`,
                          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 18px ${gr.from}26`,
                        }}
                      />
                      {selectedGradient === i && (
                        <div className="flex items-center justify-center rounded-full" style={{ width: '18px', height: '18px', border: '1px solid rgba(140,255,90,0.24)', background: 'rgba(12,26,12,0.9)', color: '#d7f7d1' }}>
                          <Check size={11} />
                        </div>
                      )}
                    </div>
                    <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '11px', fontWeight: 700 }}>{gr.label}</div>
                    <div className="matrix-muted" style={{ fontSize: '10px', marginTop: '4px' }}>{gr.code}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <ModalField label="Project Name">
            <input placeholder="e.g. Mobile App Redesign" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none transition-all" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#e2ffd8', fontSize: '14px' }} onFocus={(e) => (e.target.style.borderColor = 'rgba(140,255,90,0.4)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(121,255,102,0.12)')} />
          </ModalField>

          <ModalField label="Description">
            <textarea placeholder="Describe the project goals..." value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none resize-none transition-all" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#e2ffd8', fontSize: '14px', lineHeight: '1.6' }} rows={3} onFocus={(e) => (e.target.style.borderColor = 'rgba(140,255,90,0.4)')} onBlur={(e) => (e.target.style.borderColor = 'rgba(121,255,102,0.12)')} />
          </ModalField>

          <div className="grid grid-cols-2 gap-3">
            <ModalField label="Start Date">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#e2ffd8', fontSize: '14px', colorScheme: 'dark' }} />
            </ModalField>
            <ModalField label="Due Date">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-xl px-4 py-3 outline-none" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#e2ffd8', fontSize: '14px', colorScheme: 'dark' }} />
            </ModalField>
          </div>

          <ModalField label="Priority">
            <div className="flex gap-2">
              {[
                { p: 'Critical', c: '#FF4D4D' },
                { p: 'High', c: '#FF6A3D' },
                { p: 'Medium', c: '#F8C14A' },
                { p: 'Low', c: '#37D67A' },
              ].map(({ p, c }) => (
                <button key={p} onClick={() => setPriority(p)} className="flex-1 rounded-xl py-2.5 transition-all" style={{ background: priority === p ? `${c}20` : '#0b150b', border: `1px solid ${priority === p ? `${c}50` : 'rgba(121,255,102,0.12)'}`, color: priority === p ? c : '#89bd80', fontSize: '12px', fontWeight: priority === p ? 700 : 400 }}>
                  {p}
                </button>
              ))}
            </div>
          </ModalField>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-xl py-3 transition-all hover:opacity-80" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', color: '#89bd80', fontSize: '14px' }}>
              Cancel
            </button>
            <button onClick={handleCreate} className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 transition-all hover:opacity-90 active:scale-95" style={{ background: name.trim() ? `linear-gradient(135deg, ${g.from}, ${g.to})` : '#0b150b', color: name.trim() ? 'white' : '#5e7f58', fontSize: '14px', fontWeight: 600, boxShadow: name.trim() ? `0 4px 20px ${g.from}40` : 'none' }}>
              {loading ? <div className="rounded-full border-2 border-white/30 animate-spin" style={{ width: '16px', height: '16px', borderTopColor: 'white' }} /> : <><Plus size={14} />Create Project</>}
            </button>
          </div>
          {error && <p style={{ color: '#c5ff62', fontSize: '12px' }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="matrix-title block mb-2" style={{ color: '#5e7f58', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em' }}>{label}</label>
      {children}
    </div>
  );
}
