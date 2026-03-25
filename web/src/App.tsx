import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Me from "./pages/Me";
import Client from "./pages/Client";
import AccountSettings from "./pages/AccountSettings";
import Staff from "./pages/Staff";
import Leaderboards from "./pages/Leaderboards";
import NewsStory from "./pages/NewsStory";
import NotFound from "./pages/NotFound";
import Housekeeping from "./pages/Housekeeping/Housekeeping";
import Tickets from "./pages/Tickets";
import RegisterPoints from "./pages/RegisterPoints";
import RequireGuest from "./auth/RequireGuest";
import Install from "./pages/Install";

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Navigate to="/me" replace />} />
      <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />
      <Route path="/register" element={<RequireGuest><Register /></RequireGuest>} />
      <Route path="/staff" element={<Staff />} />
      <Route path="/leaderboards" element={<Leaderboards />} />
      <Route path="/news/:id" element={<NewsStory />} />
      <Route path="/install" element={<Install />} />

      {/* Protected Routes Wrapper */}
      <Route
       
      >
        <Route path="/housekeeping/*" element={<Housekeeping />} />
        <Route path="/account" element={<AccountSettings />} />
        <Route path="/me" element={<Me />} />
        <Route path="/client" element={<Client />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/register/points" element={<RegisterPoints />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
