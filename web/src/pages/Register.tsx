import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SiteLayout from "../components/layout/SiteLayout";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../ui/toast/ToastContext";
import "../styles/register.scss";
import { useHotelTitle } from "../hooks/useHotelTitle";

import iconId from "../assets/housekeeping/id.gif";
import iconMail from "../assets/housekeeping/user.png";
import iconLock from "../assets/housekeeping/password.png";
import iconCheck from "../assets/housekeeping/check.gif";

import { Turnstile } from "@marsidev/react-turnstile";

const USERNAME_MIN = 3;
const USERNAME_MAX = 24;

const USERNAME_REGEX = /^[a-zA-Z0-9-]+$/;

// Password: 8+ chars, 1 uppercase, 1 number, 1 special
const PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]).{8,}$/;

function validateUsername(raw: string) {
  const v = raw.trim();

  if (v.length < USERNAME_MIN)
    return `Username must be at least ${USERNAME_MIN} characters.`;
  if (v.length > USERNAME_MAX)
    return `Username cannot exceed ${USERNAME_MAX} characters.`;

  if (!USERNAME_REGEX.test(v))
    return "Username can only contain letters, numbers, and hyphen (-).";

  if (v.startsWith("-") || v.endsWith("-"))
    return "Username cannot start or end with a hyphen (-).";

  if (v.includes("--"))
    return "Username cannot contain consecutive hyphens (--).";

  return null;
}

function validatePassword(pw: string) {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!PASSWORD_REGEX.test(pw))
    return "Password must include an uppercase letter, a number, and a special character.";
  return null;
}

type IconInputProps = {
  label: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
};

function IconInput({
  label,
  icon,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  required,
  autoComplete,
  maxLength,
}: IconInputProps) {
  return (
    <div className="icon-input">
      <label>{label}</label>
      <div className="icon-input__wrap">
        <img
          className="icon-input__icon"
          src={icon}
          alt=""
          aria-hidden="true"
        />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
        />
      </div>
    </div>
  );
}

export default function Register() {
  useHotelTitle("Register");

  const nav = useNavigate();
  const { refresh, user } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // beta
  const [betaRequired, setBetaRequired] = useState(false);
  const [betaCode, setBetaCode] = useState("");

  // turnstile
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const cfg = await (api as any).getRegisterConfig?.();
        if (!alive) return;
        setBetaRequired(!!cfg?.betaRequired);
      } catch {
        if (!alive) return;
        setBetaRequired(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const usernameError = useMemo(() => validateUsername(username), [username]);
  const passwordError = useMemo(() => validatePassword(password), [password]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return null;
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }, [password, confirmPassword]);

  const betaError = useMemo(() => {
    if (!betaRequired) return null;
    if (betaCode.trim().length < 3) return "Beta code is required.";
    return null;
  }, [betaRequired, betaCode]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (usernameError) return false;
    if (passwordError) return false;
    if (!email.trim()) return false;
    if (confirmError) return false;
    if (betaError) return false;
    if (!captchaToken) return false; // require captcha
    return true;
  }, [
    loading,
    usernameError,
    passwordError,
    email,
    confirmError,
    betaError,
    captchaToken,
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const u = username.trim();
    const em = email.trim().toLowerCase();

    const uErr = validateUsername(u);
    if (uErr) {
      showToast(uErr, "error");
      return;
    }

    const pErr = validatePassword(password);
    if (pErr) {
      showToast(pErr, "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast("Passwords do not match.", "error");
      return;
    }

    if (betaRequired && betaCode.trim().length < 3) {
      showToast("Beta code is required.", "error");
      return;
    }

    if (!captchaToken) {
      showToast("Please complete the captcha verification.", "error");
      return;
    }

    setLoading(true);

    try {
      const codeToSend = betaRequired ? betaCode.trim() : undefined;

      await (api as any).register(
        u,
        em,
        password,
        confirmPassword,
        codeToSend,
        captchaToken,
      );

      showToast("Account created successfully!", "success");

      // refresh session + user
      await refresh();

      // after refresh, check if they must allocate points
      const points = Number((user as any)?.points ?? 0);

      // If your AuthContext doesn't update `user` instantly after refresh(),
      // this is a safe fallback to ensure we see the latest:
      let freshPoints = points;
      try {
        const me = await (api as any).me?.();
        const meUser = me?.user ?? me?.data?.user;
        if (meUser) freshPoints = Number(meUser.points ?? freshPoints);
      } catch {
        // ignore
      }

      if (freshPoints > 0) {
        nav("/register/points");
      } else {
        nav("/me", { replace: true });
      }
    } catch (e: any) {
      showToast(e?.message || "Failed to register.", "error");
      // optional: force user to re-verify captcha after a failed attempt
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SiteLayout active="home">
      <div className="register-page">
        <section className="panel">
          <div className="panel-head">CREATE ACCOUNT</div>

          <div className="panel-body">
            <form
              onSubmit={onSubmit}
              className="register-form"
              autoComplete="off"
            >
              <IconInput
                label="Username"
                icon={iconId}
                value={username}
                onChange={setUsername}
                required
                disabled={loading}
                autoComplete="username"
                maxLength={USERNAME_MAX}
                placeholder="your-name"
              />

              {username.length > 0 && (
                <div
                  className={`register-hint ${
                    usernameError ? "register-hint--error" : ""
                  }`}
                >
                  {!usernameError ? (
                    <span className="register-hint__ok">
                      <img
                        src={iconCheck}
                        alt=""
                        aria-hidden="true"
                        className="register-hint__check"
                      />
                      Looks good
                    </span>
                  ) : (
                    usernameError
                  )}
                </div>
              )}

              <IconInput
                label="Email"
                icon={iconMail}
                value={email}
                onChange={setEmail}
                type="email"
                required
                disabled={loading}
                autoComplete="email"
                placeholder="you@email.com"
              />

              <IconInput
                label="Password"
                icon={iconLock}
                value={password}
                onChange={setPassword}
                type="password"
                required
                disabled={loading}
                autoComplete="new-password"
              />

              {password.length > 0 && (
                <div
                  className={`register-hint ${
                    passwordError ? "register-hint--error" : ""
                  }`}
                >
                  {!passwordError ? (
                    <span className="register-hint__ok">
                      <img
                        src={iconCheck}
                        alt=""
                        aria-hidden="true"
                        className="register-hint__check"
                      />
                      Strong enough
                    </span>
                  ) : (
                    passwordError
                  )}
                </div>
              )}

              <IconInput
                label="Confirm Password"
                icon={iconLock}
                value={confirmPassword}
                onChange={setConfirmPassword}
                type="password"
                required
                disabled={loading}
                autoComplete="new-password"
              />

              {confirmPassword.length > 0 && (
                <div
                  className={`register-hint ${
                    confirmError ? "register-hint--error" : ""
                  }`}
                >
                  {!confirmError ? (
                    <span className="register-hint__ok">
                      <img
                        src={iconCheck}
                        alt=""
                        aria-hidden="true"
                        className="register-hint__check"
                      />
                      Matches
                    </span>
                  ) : (
                    confirmError
                  )}
                </div>
              )}

              {betaRequired && (
                <IconInput
                  label="Beta Code"
                  icon={iconId}
                  value={betaCode}
                  onChange={setBetaCode}
                  required
                  disabled={loading}
                  placeholder="Enter beta code"
                />
              )}

              <div style={{ marginTop: 12 }}>
                <Turnstile
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  onError={() => setCaptchaToken(null)}
                />
              </div>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={!canSubmit}
                style={{ marginTop: 14 }}
              >
                {loading ? "Creating Account..." : "Register"}
              </button>
            </form>

            <div className="register-foot muted">
              Already have an account?{" "}
              <Link to="/login" style={{ fontWeight: 700 }}>
                Login
              </Link>
            </div>
          </div>
        </section>

        <aside className="panel">
          <div className="panel-head">LIVE FEED</div>
          <div className="panel-body">
            <div className="muted">Live activity will appear here.</div>
          </div>
        </aside>
      </div>
    </SiteLayout>
  );
}
