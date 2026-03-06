import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteLayout from "../components/layout/SiteLayout";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/toast/ToastContext";
import "../styles/login.scss";
import { useHotelTitle } from "../hooks/useHotelTitle";
import { Turnstile } from "@marsidev/react-turnstile";

const MODAL_ANIM_MS = 180;

export default function Login() {
  useHotelTitle("Login");

  const nav = useNavigate();
  const { refresh } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 2FA challenge state
  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [twoFaClosing, setTwoFaClosing] = useState(false);
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  function open2FAModal(id: string) {
    setChallengeId(id);
    setTwoFaCode("");
    setTwoFaClosing(false);
    setTwoFaOpen(true);
    showToast("Enter the 6-digit code from your authenticator app.", "info");
  }

  function close2FAModal() {
    if (!twoFaOpen || twoFaClosing) return;
    setTwoFaClosing(true);
    window.setTimeout(() => {
      setTwoFaOpen(false);
      setTwoFaClosing(false);
      setTwoFaCode("");
      setChallengeId(null);
    }, MODAL_ANIM_MS);
  }

  // Lock scroll + ESC close
  useEffect(() => {
    if (!twoFaOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close2FAModal();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [twoFaOpen]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!username || !password) {
      showToast("Please enter your username and password.", "warning");
      return;
    }

    if (!captchaToken) {
      showToast("Please complete the verification.", "warning");
      return;
    }

    try {
      setLoading(true);

      // login may return { twoFaRequired, challengeId }
      const res = await api.login(username, password, captchaToken);

      if ((res as any)?.twoFaRequired && (res as any)?.challengeId) {
        // Password correct but must verify 2FA before session is created
        open2FAModal((res as any).challengeId);
        return;
      }

      // Fully logged in
      await refresh();
      showToast("Welcome back!", "success");
      nav("/client");
    } catch (e: any) {
      showToast(
        e?.response?.data?.error ||
          e?.message ||
          "Invalid username or password.",
        "error",
      );

      // reset token so user must re-verify after a failed attempt
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function verify2FA() {
    if (!challengeId) {
      showToast("2FA challenge missing. Please login again.", "error");
      close2FAModal();
      return;
    }

    const code = twoFaCode.trim();
    if (code.length < 6) {
      showToast("Enter the 6-digit code.", "warning");
      return;
    }

    setTwoFaBusy(true);
    try {
      await api.verifyLogin2FA(challengeId, code);

      // now session cookie is set → refresh user
      await refresh();

      close2FAModal();
      showToast("Welcome back!", "success");
      nav("/client");
    } catch (e: any) {
      showToast(
        e?.response?.data?.error || e?.message || "Invalid code.",
        "error",
      );
      setTwoFaCode("");
    } finally {
      setTwoFaBusy(false);
    }
  }

  return (
    <SiteLayout active="home">
      <div className="login-page">
        <div className="login-grid">
          {/* LOGIN */}
          <section className="panel login-panel">
            <div className="panel-head login-panel-head">
              <div className="login-panel-title">
                <span className="login-lock" aria-hidden="true" />
                <span>LOGIN</span>
              </div>
            </div>

            <div className="panel-body">
              <form className="login-form" onSubmit={onSubmit}>
                <label>Email or Username</label>
                <input
                  className="atom-input login-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />

                <label>Password</label>
                <input
                  className="atom-input login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />

                {/* TURNSTILE */}
                {siteKey ? (
                  <div style={{ marginTop: 12 }}>
                    <Turnstile
                      siteKey={siteKey}
                      onSuccess={(token) => setCaptchaToken(token)}
                      onExpire={() => setCaptchaToken(null)}
                      onError={() => {
                        setCaptchaToken(null);
                        showToast(
                          "Verification failed. Please try again.",
                          "error",
                        );
                      }}
                    />
                  </div>
                ) : (
                  <div className="muted" style={{ marginTop: 12 }}>
                    Missing Turnstile site key. Check <code>.env</code> and
                    restart Vite.
                  </div>
                )}

                <button
                  className="btn btn-primary login-btn"
                  type="submit"
                  disabled={loading}
                  style={{ marginTop: 12 }}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>

              <div className="login-foot">
                <div className="login-foot-left muted">
                  New here? <Link to="/register">Create an account</Link>
                </div>

                <div className="login-foot-right muted">
                  <Link to="/forgot">Forgot password?</Link>
                </div>
              </div>
            </div>
          </section>

          {/* LIVE FEED */}
          <section className="panel livefeed-panel">
            <div className="panel-head">
              <div className="login-panel-title">
                <span className="livefeed-wave" aria-hidden="true" />
                <span>LIVE FEED</span>
              </div>
            </div>

            <div className="panel-body">
              <div className="livefeed-empty muted">Live feed coming soon.</div>
            </div>
          </section>
        </div>
      </div>

      {/* ==========================
2FA LOGIN MODAL
========================== */}
      {twoFaOpen && (
        <div
          className={`acc-modal-overlay ${twoFaClosing ? "is-closing" : "is-open"}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close2FAModal();
          }}
        >
          <div className="acc-modal" role="dialog" aria-modal="true">
            <div className="acc-modal__header">
              <div className="acc-modal__title">TWO-FACTOR AUTH</div>
              <button
                type="button"
                className="acc-modal__close"
                onClick={close2FAModal}
                aria-label="Close"
                disabled={twoFaBusy}
              />
            </div>

            <div className="acc-modal__body">
              <div className="acc-modal__sub">
                Enter the 6-digit code from your authenticator app to finish
                logging in.
              </div>

              <div className="acc-2fa-right" style={{ alignItems: "center" }}>
                <label className="acc-2fa-label">6-digit code</label>

                <input
                  className="acc-2fa-input"
                  value={twoFaCode}
                  onChange={(e) =>
                    setTwoFaCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  disabled={twoFaBusy}
                />

                <div className="acc-2fa-buttons">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={verify2FA}
                    disabled={twoFaBusy}
                  >
                    {twoFaBusy ? "Verifying..." : "Verify"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={close2FAModal}
                    disabled={twoFaBusy}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <div className="acc-modal__footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={close2FAModal}
                disabled={twoFaBusy}
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}
