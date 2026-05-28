
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { WorkspaceProvider } from "./app/data/workspace-context.tsx";
  import "./styles/index.css";

  createRoot(document.getElementById("root")!).render(
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>,
  );
  
