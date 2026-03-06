import SiteLayout from "../components/layout/SiteLayout";
import { Link } from "react-router-dom";
import frank from "../assets/404/frank.png";
import { useHotelTitle } from "../hooks/useHotelTitle";

export default function NotFound() {
  useHotelTitle("Page not found!");
  return (
    <SiteLayout active="home">
      <div className="staff-grid">
        {/* LEFT (Frank + message) */}
        <div className="staff-left">
          <div className="panel">
            <div className="panel-head">PAGE NOT FOUND</div>

            <div
              className="panel-body"
              style={{ display: "flex", gap: 18, alignItems: "center" }}
            >
              <img
                src={frank}
                alt="Page Not Found"
                style={{
                  width: 140,
                  height: "auto",
                  imageRendering: "pixelated",
                  flex: "0 0 auto",
                }}
              />

              <div style={{ minWidth: 0 }}>
                <p className="staff-about" style={{ margin: 0 }}>
                  Oops! The page you're looking for doesn’t exist or may have
                  been moved.
                </p>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <Link to="/" className="btn btn-secondary">
                    Go Home
                  </Link>

                  <Link to="/client" className="btn btn-primary">
                    Open Client
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT (optional extra panel — can keep or remove) */}
        <div className="staff-right">
          <div className="panel">
            <div className="panel-head">HELP</div>
            <div className="panel-body">
              <p className="staff-about" style={{ margin: 0 }}>
                If you typed the address manually, double-check the URL.
                Otherwise, use the buttons to navigate back.
              </p>
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
