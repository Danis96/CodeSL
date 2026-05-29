import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, CheckCircle2, Clock, Zap, Flame, Trophy, Target } from 'lucide-react';
import { buildChartData } from '../data/mock-data';
import { useWorkspace } from '../data/workspace-context';

const contributionPalette = [
  'rgba(121,255,102,0.05)',
  'rgba(70,150,58,0.55)',
  'rgba(81,183,67,0.72)',
  'rgba(102,220,83,0.86)',
  '#8cff5a',
];
const contributionCellSize = 12;
const contributionGap = 3;
const contributionWeekPitch = contributionCellSize + contributionGap;

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
  const { tasks, projects, activities, currentUser } = useWorkspace();
  const chartData = buildChartData(tasks, projects, activities, currentUser?.id);
  const completed = tasks.filter((task) => task.status === 'Done' || task.status === 'Released').length;
  const total = tasks.length;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const completedWithEstimate = tasks.filter((task) => (task.status === 'Done' || task.status === 'Released') && task.estimation > 0);
  const avgTime = completedWithEstimate.length
    ? `${(completedWithEstimate.reduce((sum, task) => sum + task.estimation, 0) / completedWithEstimate.length).toFixed(1)}h`
    : '0h';
  const weeklyVelocity = chartData.weeklyTasks.reduce((sum, day) => sum + day.completed, 0);
  const totalWorkload = chartData.tasksByProject.reduce((sum, item) => sum + item.count, 0);
  const contributionStats = chartData.contributions;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 px-6 py-4 shrink-0" style={{ background: 'rgba(5,8,5,0.88)', borderBottom: '1px solid rgba(121,255,102,0.12)', backdropFilter: 'blur(12px)' }}>
        <div>
          <h1 className="matrix-title" style={{ color: '#8cff5a', fontSize: '18px', fontWeight: 800, letterSpacing: '0.08em' }}>ANALYTICS</h1>
          <p className="matrix-muted" style={{ fontSize: '12px' }}>Counted move grid + task trends</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 pb-20 md:pb-6">
        <div className="matrix-panel rounded-2xl overflow-hidden">
          <div className="p-5 pb-4">
            <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
              <div>
                <h3 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>
                  {contributionStats.total.toLocaleString()} counted moves in the last year
                </h3>
                <p className="matrix-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {currentUser?.name || 'Workspace'} heatmap. Past 365 days, one square per day.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ background: 'rgba(121,255,102,0.06)', border: '1px solid rgba(121,255,102,0.12)' }}>
                <Target size={12} style={{ color: '#8cff5a' }} />
                <span style={{ color: '#dfffd8', fontSize: '11px', fontWeight: 700 }}>
                  1 task = 1 score / 60 min
                </span>
              </div>
            </div>

            <div
              className="rounded-2xl p-4"
              style={{ background: 'linear-gradient(180deg, rgba(7,15,7,0.95) 0%, rgba(5,12,5,0.92) 100%)', border: '1px solid rgba(121,255,102,0.1)' }}
            >
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <div className="matrix-muted" style={{ fontSize: '11px' }}>
                  Scroll sideways to inspect the whole year.
                </div>
                <div className="matrix-muted" style={{ fontSize: '11px' }}>
                  Sun to Sat columns grouped by week
                </div>
              </div>

              <div className="overflow-x-auto pb-2">
                <div style={{ minWidth: `${contributionStats.weekCount * contributionWeekPitch + 116}px` }}>
                  <div className="flex gap-4">
                    <div className="shrink-0" style={{ width: '44px' }}>
                      <div style={{ height: '22px' }} />
                      <div className="grid" style={{ gridTemplateRows: `repeat(7, ${contributionCellSize}px)`, rowGap: `${contributionGap}px` }}>
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => (
                          <div
                            key={label}
                            className="flex items-center justify-end"
                            style={{ color: index % 2 === 1 ? '#9ac293' : '#567254', fontSize: '11px', lineHeight: 1 }}
                          >
                            {index % 2 === 1 ? label : ''}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <div className="relative mb-3" style={{ width: `${contributionStats.weekCount * contributionWeekPitch}px`, height: '19px' }}>
                        {contributionStats.monthLabels.map((month) => (
                          <div
                            key={month.key}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: `${month.weekIndex * contributionWeekPitch}px`,
                              color: '#b4d7ad',
                              fontSize: '12px',
                              fontWeight: 600,
                              lineHeight: 1,
                              letterSpacing: '0.03em',
                              whiteSpace: 'nowrap',
                              textShadow: '0 0 12px rgba(140,255,90,0.08)',
                            }}
                          >
                            {month.label}
                          </div>
                        ))}
                      </div>

                      <div
                        className="grid"
                        style={{
                          gridTemplateRows: `repeat(7, ${contributionCellSize}px)`,
                          gridAutoFlow: 'column',
                          gridAutoColumns: `${contributionCellSize}px`,
                          rowGap: `${contributionGap}px`,
                          columnGap: `${contributionGap}px`,
                        }}
                      >
                        {contributionStats.cells.map((day) => (
                          <div
                            key={day.key}
                            title={`${day.label}: ${day.count} counted move${day.count === 1 ? '' : 's'}`}
                            className="rounded-[4px] transition-transform hover:scale-110"
                            style={{
                              width: `${contributionCellSize}px`,
                              height: `${contributionCellSize}px`,
                              background: day.isFuture ? 'rgba(121,255,102,0.02)' : contributionPalette[day.level],
                              border: '1px solid rgba(121,255,102,0.1)',
                              boxShadow: day.level >= 3 ? '0 0 10px rgba(140,255,90,0.18)' : 'none',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr]" style={{ borderTop: '1px solid rgba(121,255,102,0.1)' }}>
            <div className="p-5">
              <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>Counting Rules</div>
              <div className="space-y-3">
                {[
                  'Same-column reorder does not count.',
                  'Backward status move does not count.',
                  'Same task can score once every rolling 60 minutes.',
                  'Heatmap intensity reflects counted moves per day.',
                ].map((rule) => (
                  <div key={rule} className="flex items-center gap-3">
                    <div className="rounded-full" style={{ width: '7px', height: '7px', background: '#8cff5a' }} />
                    <span className="matrix-copy" style={{ fontSize: '12px', color: '#d7f7d0' }}>{rule}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5" style={{ borderLeft: '1px solid rgba(121,255,102,0.1)' }}>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Current Streak', value: contributionStats.currentStreak, icon: Flame, color: '#8cff5a' },
                  { label: 'This Week', value: contributionStats.thisWeek, icon: Zap, color: '#62ffbf' },
                  { label: 'Best Day', value: contributionStats.bestDay, icon: Trophy, color: '#c5ff62' },
                  { label: 'Active Days', value: contributionStats.activeDays, icon: CheckCircle2, color: '#74ff7d' },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(8,18,8,0.7)', border: '1px solid rgba(121,255,102,0.1)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon size={14} style={{ color }} />
                      <TrendingUp size={11} style={{ color: '#6f8f68' }} />
                    </div>
                    <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '20px', fontWeight: 800 }}>{value}</div>
                    <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '2px' }}>{label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 mt-4">
                <span className="matrix-muted" style={{ fontSize: '11px' }}>Less</span>
                {contributionPalette.map((color, index) => (
                  <div key={index} className="rounded-[3px]" style={{ width: '11px', height: '11px', background: color, border: '1px solid rgba(121,255,102,0.08)' }} />
                ))}
                <span className="matrix-muted" style={{ fontSize: '11px' }}>More</span>
              </div>
            </div>
          </div>
        </div>

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
