import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, CheckCircle2, Clock, Zap, Target } from 'lucide-react';
import { buildChartData } from '../data/mock-data';
import { useWorkspace } from '../data/workspace-context';

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0d180d', border: '1px solid rgba(121,255,102,0.14)', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      {label && <p style={{ color: '#5e7f58', fontSize: '11px', marginBottom: '4px' }}>{label}</p>}
      {payload.map((entry: any) => <p key={entry.name} style={{ color: entry.color, fontSize: '13px', fontWeight: 600 }}>{entry.name}: {entry.value}</p>)}
    </div>
  );
};

export default function StatsPage() {
  const { tasks, projects } = useWorkspace();
  const chartData = buildChartData(tasks, projects);
  const completed = tasks.filter((task) => task.status === 'Done' || task.status === 'Released').length;
  const total = tasks.length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const completedWithEstimate = tasks.filter((task) => (task.status === 'Done' || task.status === 'Released') && task.estimation > 0);
  const avgTime = completedWithEstimate.length
    ? `${(completedWithEstimate.reduce((sum, task) => sum + task.estimation, 0) / completedWithEstimate.length).toFixed(1)}h`
    : '0h';
  const weeklyVelocity = chartData.weeklyTasks.reduce((sum, day) => sum + day.completed, 0);
  const totalWorkload = chartData.tasksByProject.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '18px', fontWeight: 800, letterSpacing: '0.08em' }}>ANALYTICS</h1>
          <p className="matrix-muted" style={{ fontSize: '12px' }}>Live Firestore snapshot · last 7 days + last 6 months</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 pb-20 md:pb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Tasks Completed', value: completed, sub: `${chartData.weeklyTasks.at(-1)?.completed || 0} closed today`, icon: CheckCircle2, color: '#74ff7d' },
            { label: 'Completion Rate', value: `${completionRate}%`, sub: `${total} total tracked tasks`, icon: Target, color: '#8bff77' },
            { label: 'Avg. Estimation', value: avgTime, sub: `${completedWithEstimate.length} completed estimates`, icon: Clock, color: '#62ffbf' },
            { label: 'Weekly Velocity', value: weeklyVelocity, sub: `${chartData.overdueTasks} overdue · ${chartData.dueSoonTasks} due soon`, icon: Zap, color: '#8cff5a' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="matrix-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center justify-center rounded-xl" style={{ width: '36px', height: '36px', background: color + '18' }}>
                  <Icon size={16} style={{ color }} />
                </div>
                <TrendingUp size={12} style={{ color: '#74ff7d' }} />
              </div>
              <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '24px', fontWeight: 800, lineHeight: 1 }}>{value}</div>
              <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '3px' }}>{label}</div>
              <div style={{ color: '#74ff7d', fontSize: '10px', marginTop: '2px' }}>{sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="matrix-panel lg:col-span-2 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Task Activity</h3>
                <p className="matrix-muted" style={{ fontSize: '12px' }}>Created vs completed over the last 7 days</p>
              </div>
              <div className="flex items-center gap-4">
                {[{ c: '#8bff77', l: 'Completed' }, { c: '#62ffbf', l: 'Created' }].map(({ c, l }) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="rounded-full" style={{ width: '7px', height: '7px', background: c }} />
                    <span className="matrix-muted" style={{ fontSize: '11px' }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData.weeklyTasks} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8bff77" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8bff77" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#62ffbf" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#62ffbf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121,255,102,0.06)" />
                <XAxis dataKey="day" tick={{ fill: '#5e7f58', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5e7f58', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#8bff77" strokeWidth={2} fill="url(#g1)" />
                <Area type="monotone" dataKey="created" name="Created" stroke="#62ffbf" strokeWidth={2} fill="url(#g2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="matrix-panel rounded-2xl p-5">
            <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>By Type</h3>
            <p className="matrix-muted" style={{ fontSize: '12px', marginBottom: '16px' }}>Task distribution</p>
            <ResponsiveContainer width="100%" height={150}>
              <PieChart>
                <Pie data={chartData.tasksByType} cx="50%" cy="50%" innerRadius={42} outerRadius={66} paddingAngle={3} dataKey="value">
                  {chartData.tasksByType.map((entry, index) => <Cell key={index} fill={entry.color} stroke="transparent" />)}
                </Pie>
                <Tooltip content={({ active, payload }) => active && payload?.length ? <div style={{ background: '#0d180d', border: '1px solid rgba(121,255,102,0.14)', borderRadius: '8px', padding: '6px 12px' }}><p style={{ color: payload[0].payload.color, fontSize: '13px', fontWeight: 600 }}>{payload[0].name}: {payload[0].value}</p></div> : null} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {chartData.tasksByType.map((item) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full" style={{ width: '7px', height: '7px', background: item.color }} />
                    <span className="matrix-copy" style={{ fontSize: '11px' }}>{item.name}</span>
                  </div>
                  <span style={{ color: '#ebffe5', fontSize: '11px', fontWeight: 700 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="matrix-panel rounded-2xl p-5">
            <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>By Priority</h3>
            <p className="matrix-muted" style={{ fontSize: '12px', marginBottom: '16px' }}>Tasks by urgency</p>
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={chartData.tasksByPriority} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(121,255,102,0.06)" />
                <XAxis dataKey="priority" tick={{ fill: '#5e7f58', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5e7f58', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="count" name="Tasks" radius={[6, 6, 0, 0]}>
                  {chartData.tasksByPriority.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="matrix-panel rounded-2xl p-5">
            <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>By Project</h3>
            <p className="matrix-muted" style={{ fontSize: '12px', marginBottom: '20px' }}>Live workload distribution</p>
            <div className="space-y-5">
              {chartData.tasksByProject.length === 0 && (
                <div className="matrix-muted" style={{ fontSize: '12px' }}>No project workload yet.</div>
              )}
              {chartData.tasksByProject.map((item) => {
                const width = totalWorkload ? (item.count / totalWorkload) * 100 : 0;
                return (
                  <div key={item.project}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="matrix-copy" style={{ fontSize: '13px' }}>{item.project}</span>
                      <span style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>{item.count}</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: '7px', background: 'rgba(121,255,102,0.08)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="matrix-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Monthly Progress</h3>
              <p className="matrix-muted" style={{ fontSize: '12px' }}>Completed tasks across the last 6 months</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData.monthlyTasks} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <defs>
                <linearGradient id="mGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8cff5a" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8cff5a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(121,255,102,0.06)" />
              <XAxis dataKey="month" tick={{ fill: '#5e7f58', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5e7f58', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="#8cff5a" strokeWidth={2.5} fill="url(#mGrad)" dot={{ fill: '#8cff5a', strokeWidth: 0, r: 3 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
