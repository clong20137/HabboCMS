import { useEffect } from "react";
import SiteLayout from "../components/layout/SiteLayout";
import { useClientDock } from "./ClientDock";

export default function Client() {
  const dock = useClientDock();

  useEffect(() => {
    dock.openFullscreen();
  }, [dock]);

  return (
    <SiteLayout active="home">
      <div className="panel">
        <div className="panel-head">Client</div>
        <div className="panel-body">Opening client…</div>
      </div>
    </SiteLayout>
  );
}
