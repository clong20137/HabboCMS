import React, { useEffect, useMemo, useState } from "react";
import SiteLayout from "../components/layout/SiteLayout";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import { useHotelTitle } from "../hooks/useHotelTitle";
import { useToast } from "../ui/toast/ToastContext";

// Account tab icons
import iconLock from "../assets/account/lock.png";
import iconEmail from "../assets/account/email.png";
import iconPassword from "../assets/account/password.png";

// Password tab illustration + view icon
import passwordIllustration from "../assets/account/security_ad.png";
import viewIcon from "../assets/account/view.png";

type TabKey = "security" | "email" | "password";
type Tab = { key: TabKey; label: string; icon: string };
type FieldKey = "old" | "new" | "confirm";
type FieldErrors = Partial<Record<FieldKey, string>>;

const MODAL_ANIM_MS = 180; // keep in sync with SCSS timings

type LoginHistoryRow = {
  id?: number;
  created_at?: string;
  createdAt?: string;

  ip?: string;
  user_agent?: string;
  userAgent?: string;

  two_factor_used?: number | boolean;
  twoFactorUsed?: number | boolean;

  success?: number | boolean;
};

function safeBool(v: any) {
  return v === true || v === 1 || v === "1";
}

function fmtWhen(raw?: string) {
  if (!raw) return "Unknown time";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}

export default function AccountSettings() {
  useHotelTitle("Account Settings");
  const { user } = useAuth();
  const { showToast } = useToast();

  const tabs: Tab[] = useMemo(
    () => [
      { key: "security", label: "Security", icon: iconLock },
      { key: "email", label: "Email", icon: iconEmail },
      { key: "password", label: "Password", icon: iconPassword },
    ],
    [],
  );

  const [active, setActive] = useState<TabKey>("security");
  const [isFading, setIsFading] = useState(false);

  // Password form state
  const [oldPass, setOldPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // View toggles
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);

  // Field errors
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // 2FA state
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);

  // Modal visibility + exit animation
  const [twoFaSetupOpen, setTwoFaSetupOpen] = useState(false);
  const [twoFaClosing, setTwoFaClosing] = useState(false);

  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaQr, setTwoFaQr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // ✅ Login history (security tab only)
  const [loginRows, setLoginRows] = useState<LoginHistoryRow[]>([]);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginLoadedOnce, setLoginLoadedOnce] = useState(false);

  function switchTab(next: TabKey) {
    if (next === active) return;
    setFieldErrors({});
    setIsFading(true);
    window.setTimeout(() => {
      setActive(next);
      requestAnimationFrame(() => setIsFading(false));
    }, 160);
  }

  const title = useMemo(() => {
    const found = tabs.find((t) => t.key === active);
    return (found?.label ?? "Account").toUpperCase();
  }, [active, tabs]);

  // load 2FA status
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const st = await api.get2FAStatus();
        setTwoFaEnabled(!!st.enabled);
      } catch {
        // ignore
      }
    })();
  }, [user]);

  // ✅ Load login history ONLY when on Security tab (and only once unless refreshed)
  useEffect(() => {
    if (!user) return;
    if (active !== "security") return;

    if (loginLoadedOnce) return;

    (async () => {
      setLoginBusy(true);
      try {
        const r = await api.getLoginHistory(20);
        setLoginRows(Array.isArray(r.rows) ? r.rows : []);
        setLoginLoadedOnce(true);
      } catch (e: any) {
        showToast(e?.message || "Failed to load login history.", "error");
      } finally {
        setLoginBusy(false);
      }
    })();
  }, [active, user, loginLoadedOnce, showToast]);

  async function refreshLoginHistory() {
    if (!user) return;
    setLoginBusy(true);
    try {
      const r = await api.getLoginHistory(20);
      setLoginRows(Array.isArray(r.rows) ? r.rows : []);
      setLoginLoadedOnce(true);
      showToast("Login history refreshed.", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to refresh login history.", "error");
    } finally {
      setLoginBusy(false);
    }
  }

  // Close 2FA modal (animated)
  function close2FAModal() {
    if (!twoFaSetupOpen || twoFaClosing) return;
    setTwoFaClosing(true);

    window.setTimeout(() => {
      setTwoFaSetupOpen(false);
      setTwoFaClosing(false);
      setTwoFaQr(null);
      setBackupCodes([]);
      setTwoFaCode("");
    }, MODAL_ANIM_MS);
  }

  // Lock scroll + ESC close when modal open
  useEffect(() => {
    if (!twoFaSetupOpen) return;

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
  }, [twoFaSetupOpen]);

  if (!user) {
    return (
      <SiteLayout active="home">
        <div className="panel">
          <div className="panel-body">
            <div className="muted">Not logged in.</div>
          </div>
        </div>
      </SiteLayout>
    );
  }

  function validatePasswordForm(): boolean {
    const errs: FieldErrors = {};

    const oldP = oldPass.trim();
    const newP = newPass.trim();
    const conP = confirmPass.trim();

    if (!oldP) errs.old = "Old password is required.";
    if (!newP) errs.new = "New password is required.";
    if (!conP) errs.confirm = "Please confirm your new password.";

    if (newP && newP.length < 6)
      errs.new = "New password must be at least 6 characters.";

    if (newP && conP && newP !== conP) {
      errs.new = "Passwords do not match.";
      errs.confirm = "Passwords do not match.";
    }

    if (oldP && newP && oldP === newP)
      errs.new = "New password must be different.";

    setFieldErrors(errs);

    if (Object.keys(errs).length) {
      showToast("Please fix the highlighted fields.", "error");
      const firstErr = errs.old || errs.new || errs.confirm;
      if (firstErr) showToast(firstErr, "warning");
      return false;
    }

    return true;
  }

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!validatePasswordForm()) return;

    setSaving(true);
    try {
      await api.changePassword(
        oldPass.trim(),
        newPass.trim(),
        confirmPass.trim(),
      );
      showToast("Password updated successfully.", "success");

      setOldPass("");
      setNewPass("");
      setConfirmPass("");
      setShowOld(false);
      setShowNew(false);
      setShowConfirm(false);
      setFieldErrors({});
    } catch (err: any) {
      const msg = String(err?.message || "Failed to update password.");
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  }

  async function start2FA() {
    setTwoFaBusy(true);
    try {
      const r = await api.start2FASetup();
      setTwoFaQr(r.qrDataUrl);
      setBackupCodes(r.backupCodes || []);
      setTwoFaCode("");
      setTwoFaClosing(false);
      setTwoFaSetupOpen(true);
      showToast("Scan the QR code, then enter your 6-digit code.", "info");
    } catch (e: any) {
      showToast(e?.message || "Failed to start 2FA setup.", "error");
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function enable2FA() {
    const code = twoFaCode.trim();
    if (code.length < 6) {
      showToast(
        "Enter the 6-digit code from your authenticator app.",
        "warning",
      );
      return;
    }

    setTwoFaBusy(true);
    try {
      await api.enable2FA(code);
      setTwoFaEnabled(true);
      close2FAModal();
      showToast("Two-factor authentication enabled!", "success");
    } catch (e: any) {
      showToast(e?.message || "Invalid code. Try again.", "error");
    } finally {
      setTwoFaBusy(false);
    }
  }

  async function disable2FA() {
    setTwoFaBusy(true);
    try {
      await api.disable2FA();
      setTwoFaEnabled(false);
      close2FAModal();
      showToast("Two-factor authentication disabled.", "success");
    } catch (e: any) {
      showToast(e?.message || "Failed to disable 2FA.", "error");
    } finally {
      setTwoFaBusy(false);
    }
  }

  function copyBackupCodes() {
    if (!backupCodes.length) return;
    navigator.clipboard
      .writeText(backupCodes.join("\n"))
      .then(() => showToast("Backup codes copied.", "success"))
      .catch(() => showToast("Could not copy backup codes.", "error"));
  }

  const oldInvalid = Boolean(fieldErrors.old);
  const newInvalid = Boolean(fieldErrors.new);
  const confirmInvalid = Boolean(fieldErrors.confirm);

  return (
    <SiteLayout active="home">
      {/* Module open animation */}
      <div className="account-module account-module--enter">
        <div className="account-grid">
          {/* LEFT SIDE TABS */}
          <aside className="account-tabs panel">
            <div className="panel-head">SETTINGS</div>

            <div className="account-tabs__list">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={`account-tab ${active === tab.key ? "active" : ""}`}
                  onClick={() => switchTab(tab.key)}
                >
                  <img className="account-tab__icon" src={tab.icon} alt="" />
                  <span className="account-tab__label">{tab.label}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* RIGHT SIDE CONTENT */}
          <section className="account-content panel">
            <div className="panel-head">{title}</div>

            <div
              className={`panel-body fade-swap ${isFading ? "is-fading" : ""}`}
            >
              {active === "security" && (
                <div className="settings-stack">
                  {/* 2FA card */}
                  <div
                    className="settings-card"
                    style={{ alignItems: "stretch" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div className="settings-card__title">
                          Two-Factor Authentication
                        </div>
                        <div className="muted">
                          {twoFaEnabled ? "Enabled" : "Not configured"}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        {!twoFaEnabled ? (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={start2FA}
                            disabled={twoFaBusy}
                          >
                            {twoFaBusy ? "Loading..." : "Setup"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={disable2FA}
                            disabled={twoFaBusy}
                          >
                            {twoFaBusy ? "Working..." : "Disable"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ✅ Login history lives INSIDE security tab */}
                    <div className="login-history">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div>
                          <div
                            className="settings-card__title"
                            style={{ marginBottom: 2 }}
                          >
                            Login History
                          </div>
                          <div className="muted">
                            Recent logins to your account.
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={refreshLoginHistory}
                          disabled={loginBusy}
                        >
                          {loginBusy ? "Loading..." : "Refresh"}
                        </button>
                      </div>

                      <div className="login-history__list">
                        {loginBusy && !loginRows.length ? (
                          <div className="muted">Loading login history...</div>
                        ) : !loginRows.length ? (
                          <div className="muted">No login history yet.</div>
                        ) : (
                          loginRows.map((row, idx) => {
                            const whenRaw = row.created_at || row.createdAt;
                            const ip = row.ip || "-";
                            const ua = row.user_agent || row.userAgent || "-";
                            const used2fa = safeBool(
                              row.two_factor_used ?? row.twoFactorUsed,
                            );
                            const okLogin =
                              row.success == null
                                ? true
                                : safeBool(row.success);

                            return (
                              <div
                                key={String(row.id ?? idx)}
                                className="login-history__row"
                              >
                                <div className="login-history__when">
                                  {fmtWhen(String(whenRaw || ""))}
                                </div>

                                <div className="login-history__meta">
                                  <span className="login-history__pill">
                                    {okLogin ? "SUCCESS" : "FAILED"}
                                  </span>
                                  <span className="login-history__pill">
                                    {used2fa ? "2FA" : "NO 2FA"}
                                  </span>
                                  <span className="login-history__ip">
                                    {ip}
                                  </span>
                                </div>

                                <div className="login-history__ua">{ua}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Passkeys placeholder */}
                  <div className="settings-card">
                    <div>
                      <div className="settings-card__title">Passkeys</div>
                      <div className="muted">Passkeys are not available at this time.</div>
                      <br></br>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          showToast("Passkeys coming soon.", "info")
                        }
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {active === "email" && (
                <div className="settings-stack">
                  <div className="settings-card">
                    <div>
                      <div className="settings-card__title">Email Address</div>
                      <div className="muted">{user.mail ?? "-"}</div>
                    </div>
                    <div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          showToast("Email change coming soon.", "info")
                        }
                      >
                        Change
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {active === "password" && (
                <div className="password-page">
                  <div className="password-top">
                    <div className="password-top__title">Reset Password</div>
                    <div className="password-top__sub muted">
                      Enter your current password, then choose a new one.
                    </div>
                  </div>

                  <div className="password-body">
                    <div className="password-illustration">
                      <img src={passwordIllustration} alt="" />
                    </div>

                    <div className="password-right">
                      <form
                        onSubmit={submitPasswordChange}
                        className="password-form"
                      >
                        <div className="password-field">
                          <label>Old Password</label>

                          <div
                            className={`pw-input-wrap ${oldInvalid ? "is-invalid" : ""}`}
                          >
                            <input
                              className="pw-input"
                              type={showOld ? "text" : "password"}
                              value={oldPass}
                              onChange={(e) => {
                                setOldPass(e.target.value);
                                if (fieldErrors.old)
                                  setFieldErrors((p) => ({
                                    ...p,
                                    old: undefined,
                                  }));
                              }}
                              disabled={saving}
                              autoComplete="current-password"
                              aria-invalid={oldInvalid}
                            />

                            <button
                              type="button"
                              className="pw-view-btn"
                              onClick={() => setShowOld((s) => !s)}
                              aria-label={
                                showOld ? "Hide password" : "Show password"
                              }
                              disabled={saving}
                              tabIndex={-1}
                            >
                              <img src={viewIcon} alt="" />
                            </button>
                          </div>
                        </div>

                        <div className="password-field">
                          <label>New Password</label>

                          <div
                            className={`pw-input-wrap ${newInvalid ? "is-invalid" : ""}`}
                          >
                            <input
                              className="pw-input"
                              type={showNew ? "text" : "password"}
                              value={newPass}
                              onChange={(e) => {
                                setNewPass(e.target.value);
                                if (fieldErrors.new)
                                  setFieldErrors((p) => ({
                                    ...p,
                                    new: undefined,
                                  }));
                              }}
                              disabled={saving}
                              autoComplete="new-password"
                              aria-invalid={newInvalid}
                            />

                            <button
                              type="button"
                              className="pw-view-btn"
                              onClick={() => setShowNew((s) => !s)}
                              aria-label={
                                showNew ? "Hide password" : "Show password"
                              }
                              disabled={saving}
                              tabIndex={-1}
                            >
                              <img src={viewIcon} alt="" />
                            </button>
                          </div>
                        </div>

                        <div className="password-field">
                          <label>Confirm New Password</label>

                          <div
                            className={`pw-input-wrap ${confirmInvalid ? "is-invalid" : ""}`}
                          >
                            <input
                              className="pw-input"
                              type={showConfirm ? "text" : "password"}
                              value={confirmPass}
                              onChange={(e) => {
                                setConfirmPass(e.target.value);
                                if (fieldErrors.confirm)
                                  setFieldErrors((p) => ({
                                    ...p,
                                    confirm: undefined,
                                  }));
                              }}
                              disabled={saving}
                              autoComplete="new-password"
                              aria-invalid={confirmInvalid}
                            />

                            <button
                              type="button"
                              className="pw-view-btn"
                              onClick={() => setShowConfirm((s) => !s)}
                              aria-label={
                                showConfirm ? "Hide password" : "Show password"
                              }
                              disabled={saving}
                              tabIndex={-1}
                            >
                              <img src={viewIcon} alt="" />
                            </button>
                          </div>
                        </div>

                        <div className="password-actions">
                          <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save Password"}
                          </button>
                        </div>
                      </form>

                      <div className="muted" style={{ marginTop: 10 }}>
                        Tip: Use a long, unique password you don’t use anywhere
                        else.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ==========================
2FA SETUP MODAL POPOVER
========================== */}
        {twoFaSetupOpen && !twoFaEnabled && (
          <div
            className={`acc-modal-overlay ${twoFaClosing ? "is-closing" : "is-open"}`}
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close2FAModal();
            }}
          >
            <div className="acc-modal" role="dialog" aria-modal="true">
              <div className="acc-modal__header">
                <div className="acc-modal__title">SECURITY</div>
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
                  Scan with Google Authenticator/Authy/1Password, then enter the
                  6-digit code.
                </div>

                <div className="acc-2fa-layout">
                  <div className="acc-2fa-qr">
                    <div className="acc-qr-box">
                      {twoFaQr ? (
                        <img
                          src={twoFaQr}
                          alt="2FA QR code"
                          className="acc-qr-img"
                        />
                      ) : (
                        <div className="muted">Loading QR...</div>
                      )}
                    </div>

                    {backupCodes.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={copyBackupCodes}
                        disabled={twoFaBusy}
                      >
                        Copy Codes
                      </button>
                    )}
                  </div>

                  <div className="acc-2fa-right">
                    <label className="acc-2fa-label">6-digit code</label>

                    <input
                      className="acc-2fa-input"
                      value={twoFaCode}
                      onChange={(e) =>
                        setTwoFaCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
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
                        onClick={enable2FA}
                        disabled={twoFaBusy}
                      >
                        {twoFaBusy ? "Verifying..." : "Enable 2FA"}
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

                    {backupCodes.length > 0 && (
                      <div className="acc-backup">
                        <div className="acc-backup__title">
                          Backup codes (save these now)
                        </div>

                        <div className="acc-backup__list">
                          {backupCodes.map((c) => (
                            <div key={c}>{c}</div>
                          ))}
                        </div>

                        <div className="acc-backup__note muted">
                          Each code can be used once.
                        </div>
                      </div>
                    )}
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
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
