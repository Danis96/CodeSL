import { useState, useEffect } from "react";
import Sidebar from "./components/sidebar";
import MobileNav from "./components/mobile-nav";
import LoginPage from "./components/login-page";
import Dashboard from "./components/dashboard";
import ProjectsList from "./components/projects-list";
import KanbanBoard from "./components/kanban-board";
import EpicsPage from "./components/epics-page";
import MembersPage from "./components/members-page";
import StatsPage from "./components/stats-page";
import SettingsPage from "./components/settings-page";
import { useWorkspace } from "./data/workspace-context";
import { Toaster, toast } from "sonner";

export type Page =
  | "dashboard"
  | "projects"
  | "kanban"
  | "epics"
  | "members"
  | "stats"
  | "settings";

export default function App() {
  const {
    authUser,
    authLoading,
    projects,
    completeGitHubInstallation,
  } = useWorkspace();
  const [currentPage, setCurrentPage] =
    useState<Page>("dashboard");
  const [selectedProjectId, setSelectedProjectId] =
    useState<string>("");
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(false);
  const [finishingGitHubInstall, setFinishingGitHubInstall] =
    useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects[0]?.id) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!authUser || finishingGitHubInstall) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const installationId = params.get("installation_id");
    const numericInstallationId = Number(installationId);

    if (!numericInstallationId) {
      return;
    }

    setFinishingGitHubInstall(true);

    void completeGitHubInstallation(numericInstallationId)
      .then(() => {
        toast.success("GitHub connected.");
        params.delete("installation_id");
        const nextQuery = params.toString();
        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
        );
        setCurrentPage("settings");
      })
      .catch((error) => {
        console.error(error);
        toast.error("GitHub install finish failed.");
      })
      .finally(() => {
        setFinishingGitHubInstall(false);
      });
  }, [authUser, completeGitHubInstallation, finishingGitHubInstall]);

  if (authLoading) {
    return (
      <>
        <Toaster theme="dark" richColors position="top-right" />
        <div className="min-h-screen" style={{ background: "#080808" }} />
      </>
    );
  }

  if (!authUser) {
    return (
      <>
        <Toaster theme="dark" richColors position="top-right" />
        <LoginPage />
      </>
    );
  }

  const handleProjectClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage("kanban");
  };

  return (
    <>
      <Toaster theme="dark" richColors position="top-right" />
      <div className="matrix-shell flex h-screen overflow-hidden bg-background text-foreground">
        {/* MARKER-MAKE-KIT-INVOKED */}
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() =>
            setSidebarCollapsed(!sidebarCollapsed)
          }
        />
        <main
          className="flex-1 overflow-hidden flex flex-col"
          style={{ minWidth: 0 }}
        >
          {currentPage === "dashboard" && (
            <Dashboard
              onProjectClick={handleProjectClick}
              onNavigate={setCurrentPage}
            />
          )}
          {currentPage === "projects" && (
            <ProjectsList onProjectClick={handleProjectClick} />
          )}
          {currentPage === "kanban" && (
            <KanbanBoard projectId={selectedProjectId} />
          )}
          {currentPage === "epics" && <EpicsPage />}
          {currentPage === "members" && <MembersPage />}
          {currentPage === "stats" && <StatsPage />}
          {currentPage === "settings" && (
            <SettingsPage />
          )}
        </main>
        <MobileNav
          currentPage={currentPage}
          onNavigate={setCurrentPage}
        />
      </div>
    </>
  );
}
