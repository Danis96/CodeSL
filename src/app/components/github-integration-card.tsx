import { useEffect, useMemo, useState } from 'react';
import { Check, Github, Link2, RefreshCw, Shield, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspace, type GitHubRepositoryOption } from '../data/workspace-context';

const NEW_PROJECT = '__new__';

export default function GitHubIntegrationCard() {
  const {
    currentUser,
    projects,
    getGitHubInstallUrl,
    completeGitHubInstallation,
    disconnectGitHub,
    listGitHubRepositories,
    importGitHubRepository,
    syncGitHubProject,
  } = useWorkspace();
  const [repositories, setRepositories] = useState<GitHubRepositoryOption[]>([]);
  const [repoTargets, setRepoTargets] = useState<Record<number, string>>({});
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [importingRepoId, setImportingRepoId] = useState<number | null>(null);
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null);

  const connectedProjects = useMemo(
    () => projects.filter((project) => project.github),
    [projects],
  );

  const loadRepositories = async () => {
    if (!currentUser?.github) {
      setRepositories([]);
      return;
    }

    setLoadingRepos(true);

    try {
      const nextRepositories = await listGitHubRepositories();
      setRepositories(nextRepositories);
      setRepoTargets((current) => {
        const nextTargets = { ...current };

        nextRepositories.forEach((repository) => {
          nextTargets[repository.id] = repository.alreadyImportedProjectId || nextTargets[repository.id] || NEW_PROJECT;
        });

        return nextTargets;
      });
    } catch (error) {
      console.error(error);
      toast.error('GitHub repositories failed to load.');
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    void loadRepositories();
  }, [currentUser?.github?.installationId]);

  const handleConnect = async () => {
    setConnecting(true);

    try {
      const url = await getGitHubInstallUrl();
      window.location.assign(url);
    } catch (error) {
      console.error(error);
      toast.error('GitHub install link failed.');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);

    try {
      await disconnectGitHub();
      setRepositories([]);
      toast.success('GitHub disconnected.');
    } catch (error) {
      console.error(error);
      toast.error('GitHub disconnect failed.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleImport = async (repositoryId: number) => {
    setImportingRepoId(repositoryId);

    try {
      const target = repoTargets[repositoryId];
      await importGitHubRepository({
        repositoryId,
        projectId: target && target !== NEW_PROJECT ? target : undefined,
      });
      toast.success('Repository imported. Issues syncing now.');
      await loadRepositories();
    } catch (error) {
      console.error(error);
      toast.error('Repository import failed.');
    } finally {
      setImportingRepoId(null);
    }
  };

  const handleSync = async (projectId: string) => {
    setSyncingProjectId(projectId);

    try {
      const result = await syncGitHubProject(projectId);
      toast.success(`Synced ${result.imported} GitHub issues.`);
    } catch (error) {
      console.error(error);
      toast.error('GitHub sync failed.');
    } finally {
      setSyncingProjectId(null);
    }
  };

  return (
    <div className="matrix-panel rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Github size={15} style={{ color: '#ebffe5' }} />
            <h2 className="matrix-title" style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>Integrations</h2>
          </div>
          <div className="matrix-muted" style={{ fontSize: '12px' }}>
            Install GitHub App. Import repos. Sync issues into Slave tasks.
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1"
          style={{
            background: currentUser?.github ? 'rgba(116,255,125,0.14)' : 'rgba(121,255,102,0.08)',
            color: currentUser?.github ? '#74ff7d' : '#89bd80',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {currentUser?.github ? 'CONNECTED' : 'NOT CONNECTED'}
        </span>
      </div>

      <div className="rounded-2xl p-5 mb-5" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div style={{ color: '#ebffe5', fontSize: '14px', fontWeight: 700 }}>GitHub App</div>
            <div className="matrix-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
              {currentUser?.github
                ? `${currentUser.github.accountLogin} · installation #${currentUser.github.installationId}`
                : 'Backend keeps app keys, tokens, webhook secret.'}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {!currentUser?.github && (
              <button
                onClick={() => void handleConnect()}
                disabled={connecting}
                className="flex items-center gap-2 rounded-xl px-4 py-3 transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, rgba(120,255,99,0.16), rgba(72,168,66,0.26))', border: '1px solid rgba(121,255,102,0.18)', color: '#e8ffe1', fontSize: '13px', fontWeight: 600 }}
              >
                <Link2 size={13} />
                {connecting ? 'Opening GitHub...' : 'Install GitHub App'}
              </button>
            )}
            {currentUser?.github && (
              <button
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
                className="flex items-center gap-2 rounded-xl px-4 py-3 transition-all hover:opacity-90"
                style={{ background: 'rgba(121,255,102,0.08)', border: '1px solid rgba(121,255,102,0.14)', color: '#8cff5a', fontSize: '13px', fontWeight: 600 }}
              >
                <Unplug size={13} />
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4" style={{ color: '#5e7f58', fontSize: '11px' }}>
          <Shield size={12} />
          Setup URL should point back to this app so `installation_id` returns here.
        </div>
      </div>

      {currentUser?.github && (
        <div className="space-y-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="matrix-title" style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 700 }}>Repository Import</div>
              <button
                onClick={() => void loadRepositories()}
                disabled={loadingRepos}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all hover:opacity-90"
                style={{ background: 'rgba(121,255,102,0.08)', border: '1px solid rgba(121,255,102,0.12)', color: '#89bd80', fontSize: '12px' }}
              >
                <RefreshCw size={12} className={loadingRepos ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>

            <div className="space-y-3">
              {repositories.length === 0 && (
                <div className="rounded-2xl p-4 matrix-muted" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', fontSize: '12px' }}>
                  {loadingRepos ? 'Loading repositories...' : 'No repositories found on this installation yet.'}
                </div>
              )}
              {repositories.map((repository) => (
                <div key={repository.id} className="rounded-2xl p-4" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>{repository.fullName}</div>
                        {repository.alreadyImportedProjectId && (
                          <span className="rounded-full px-2 py-0.5" style={{ background: 'rgba(116,255,125,0.14)', color: '#74ff7d', fontSize: '10px', fontWeight: 700 }}>
                            IMPORTED
                          </span>
                        )}
                      </div>
                      <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '5px' }}>
                        {repository.visibility} · {repository.defaultBranch} · {repository.openIssuesCount} open issues
                      </div>
                    </div>
                    <button
                      onClick={() => void handleImport(repository.id)}
                      disabled={importingRepoId === repository.id}
                      className="rounded-xl px-3 py-2 transition-all hover:opacity-90"
                      style={{ background: 'rgba(121,255,102,0.08)', border: '1px solid rgba(121,255,102,0.14)', color: '#8cff5a', fontSize: '12px', fontWeight: 700 }}
                    >
                      {importingRepoId === repository.id ? 'Importing...' : repository.alreadyImportedProjectId ? 'Re-sync Import' : 'Import Repo'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mt-4">
                    <select
                      value={repoTargets[repository.id] || NEW_PROJECT}
                      onChange={(event) => setRepoTargets((current) => ({ ...current, [repository.id]: event.target.value }))}
                      className="rounded-xl px-3 outline-none"
                      style={{ background: 'rgba(8,18,8,0.92)', border: '1px solid rgba(121,255,102,0.12)', color: '#c7eac1', fontSize: '12px', height: '40px', colorScheme: 'dark' }}
                    >
                      <option value={NEW_PROJECT}>Create new Slave project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          Map to {project.title}
                        </option>
                      ))}
                    </select>
                    <a href={repository.htmlUrl} target="_blank" rel="noreferrer" style={{ color: '#8cff5a', fontSize: '12px', alignSelf: 'center' }}>
                      Open repo
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="matrix-title mb-3" style={{ color: '#ebffe5', fontSize: '12px', fontWeight: 700 }}>Imported Projects</div>
            <div className="space-y-3">
              {connectedProjects.length === 0 && (
                <div className="rounded-2xl p-4 matrix-muted" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)', fontSize: '12px' }}>
                  No Slave projects linked to GitHub yet.
                </div>
              )}
              {connectedProjects.map((project) => (
                <div key={project.id} className="rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3" style={{ background: '#0b150b', border: '1px solid rgba(121,255,102,0.12)' }}>
                  <div>
                    <div className="flex items-center gap-2">
                      <div style={{ color: '#ebffe5', fontSize: '13px', fontWeight: 700 }}>{project.title}</div>
                      <Check size={12} style={{ color: '#74ff7d' }} />
                    </div>
                    <div className="matrix-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                      {project.github?.fullName} · last sync {project.github?.syncedAt ? new Date(project.github.syncedAt).toLocaleString() : 'never'}
                    </div>
                  </div>
                  <button
                    onClick={() => void handleSync(project.id)}
                    disabled={syncingProjectId === project.id}
                    className="flex items-center gap-2 rounded-xl px-3 py-2 transition-all hover:opacity-90"
                    style={{ background: 'rgba(121,255,102,0.08)', border: '1px solid rgba(121,255,102,0.12)', color: '#8cff5a', fontSize: '12px', fontWeight: 700 }}
                  >
                    <RefreshCw size={12} className={syncingProjectId === project.id ? 'animate-spin' : ''} />
                    {syncingProjectId === project.id ? 'Syncing...' : 'Sync Issues'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
