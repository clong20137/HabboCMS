import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";
import ClientDockProvider from "./pages/ClientDock";
import { ToastProvider } from "./ui/toast/ToastContext";

import "./styles/global.scss";
import "./styles.css";
import "./styles/account.scss";
import "./styles/staff.scss";
import "./styles/leaderboards.scss";
import "./styles/client.scss";
import "./styles/notfound.scss";
import "./styles/Housekeeping/housekeeping.scss";
import "./styles/Housekeeping/housekeeping-wordfilter.scss";
import "./styles/Housekeeping/housekeeping-tickets.scss";
import "./styles/toast.scss";
import "./styles/install.scss";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ClientDockProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </ClientDockProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
