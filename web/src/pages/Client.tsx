import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SiteLayout from "../components/layout/SiteLayout";
import { useClientDock } from "./ClientDock";

export default function Client() {
  const nav = useNavigate();
  const dock = useClientDock();

  useEffect(() => {
    dock.openFullscreen(); // or dock.openDock()
    nav("/me", { replace: true }); // go back wherever you want
  }, []);

  return (
    <SiteLayout active="home">
      <div className="panel">
        <div className="panel-head">Client</div>
        <div className="panel-body">Opening client…</div>
      </div>
    </SiteLayout>
  );
}
