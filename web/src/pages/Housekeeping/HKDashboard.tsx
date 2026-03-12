import { useEffect, useMemo, useState } from "react";
import { useToast } from "../../ui/toast/ToastContext";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
} from "recharts";

type Props = {
  me: any;
};

type MetricKey = "registrations" | "credits" | "online_peak" | "shifts_worked";
type RangeKey = "7d" | "30d" | "90d" | "1y";

type DashboardSummary = {
  totalUsers: number;
  usersLast7Days: number;
  usersLast30Days: number;
  totalCredits: number;
  peakConcurrentUsers: number;
  currentOnlineUsers: number;
  mostActiveHour: number;
  shiftsWorkedTotal: number;
};

type TrendPoint = {
  label: string;
  value: number;
};

type HourlyPoint = {
  hour: number;
  label: string;
  value: number;
};

async function hkGet<T>(url: string): Promise<T> {
  const r = await fetch(url, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.error || "Request failed");
  return data as T;
}

function getThemeVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function formatNumber(v: number) {
  return Number(v || 0).toLocaleString();
}

function formatCurrency(v: number) {
  return `$${Number(v || 0).toLocaleString()}`;
}

function formatHour(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized}${suffix}`;
}

function metricLabel(metric: MetricKey) {
  switch (metric) {
    case "registrations":
      return "Registrations";
    case "credits":
      return "Credits Circulating";
    case "online_peak":
      return "Users Online";
    case "shifts_worked":
      return "Shifts Worked";
  }
}

function DashboardCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="hk-dashboard__card">
      <div className="hk-dashboard__cardLabel">{label}</div>
      <div className="hk-dashboard__cardValue">{value}</div>
      {sub && <div className="hk-dashboard__cardSub">{sub}</div>}
    </div>
  );
}

export default function HKDashboard({ me }: Props) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [metric, setMetric] = useState<MetricKey>("registrations");
  const [range, setRange] = useState<RangeKey>("30d");
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingCharts, setLoadingCharts] = useState(true);

  const chartPrimary = getThemeVar("--primary-color", "#6fd3ff");
  const chartSecondary = getThemeVar("--secondary-color", "#40d76b");
  const chartGrid = "rgba(255,255,255,0.10)";
  const chartText = "rgba(255,255,255,0.72)";

  useEffect(() => {
    let dead = false;

    async function loadSummary() {
      try {
        setLoadingSummary(true);
        const data = await hkGet<{ ok: boolean; summary: DashboardSummary }>("/api/hk/dashboard");
        if (dead) return;
        setSummary(data.summary);
      } catch (e: any) {
        if (dead) return;
        showToast(e?.message || "Failed to load dashboard summary.", "error");
      } finally {
        if (!dead) setLoadingSummary(false);
      }
    }

    loadSummary();
    const timer = window.setInterval(loadSummary, 60000);

    return () => {
      dead = true;
      window.clearInterval(timer);
    };
  }, [showToast]);

  useEffect(() => {
    let dead = false;

    async function loadCharts() {
      try {
        setLoadingCharts(true);
        const [trendData, activityData] = await Promise.all([
          hkGet<{ ok: boolean; metric: MetricKey; range: RangeKey; points: TrendPoint[] }>(
            `/api/hk/dashboard/trends?metric=${encodeURIComponent(metric)}&range=${encodeURIComponent(range)}`
          ),
          hkGet<{ ok: boolean; range: RangeKey; hourly: HourlyPoint[] }>(
            `/api/hk/dashboard/activity?range=${encodeURIComponent(range)}`
          ),
        ]);

        if (dead) return;
        setTrend(Array.isArray(trendData.points) ? trendData.points : []);
        setHourly(Array.isArray(activityData.hourly) ? activityData.hourly : []);
      } catch (e: any) {
        if (dead) return;
        showToast(e?.message || "Failed to load dashboard charts.", "error");
      } finally {
        if (!dead) setLoadingCharts(false);
      }
    }

    loadCharts();

    return () => {
      dead = true;
    };
  }, [metric, range, showToast]);

  const topHour = useMemo(() => {
    if (!hourly.length) return null;
    return [...hourly].sort((a, b) => b.value - a.value)[0] || null;
  }, [hourly]);

  return (
    <div className="panel hk-dashboard">
      <div className="panel-head">HOUSEKEEPING DASHBOARD</div>
      <div className="panel-body">
        <div className="hk-dashboard__welcome">
          <div>
            <div className="hk-dashboard__welcomeTitle">Welcome, {me?.user?.username}</div>
            <div className="hk-dashboard__welcomeSub">
              Rank {me?.user?.rank} • Live operational metrics
            </div>
          </div>
        </div>

        {loadingSummary || !summary ? (
          <div className="hk-loading">Loading dashboard…</div>
        ) : (
          <>
            <div className="hk-dashboard__cards">
              <DashboardCard label="Users Registered" value={formatNumber(summary.totalUsers)} />
              <DashboardCard label="Registered Last Week" value={formatNumber(summary.usersLast7Days)} />
              <DashboardCard label="Registered Last Month" value={formatNumber(summary.usersLast30Days)} />
              <DashboardCard label="Credits Circulating" value={formatCurrency(summary.totalCredits)} />
              <DashboardCard label="Current Online" value={formatNumber(summary.currentOnlineUsers)} />
              <DashboardCard label="Peak Concurrent" value={formatNumber(summary.peakConcurrentUsers)} sub="tracked from analytics snapshots" />
              <DashboardCard label="Most Active Hour" value={formatHour(summary.mostActiveHour)} />
              <DashboardCard label="Total Shifts Worked" value={formatNumber(summary.shiftsWorkedTotal)} />
            </div>

            <div className="hk-dashboard__panelRow">
              <div className="hk-dashboard__panel">
                <div className="hk-dashboard__toolbar">
                  <div className="hk-dashboard__toolbarGroup">
                    {(["registrations", "credits", "online_peak", "shifts_worked"] as MetricKey[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`btn ${metric === m ? "btn-primary" : ""}`}
                        onClick={() => setMetric(m)}
                      >
                        {metricLabel(m)}
                      </button>
                    ))}
                  </div>

                  <div className="hk-dashboard__toolbarGroup">
                    {(["7d", "30d", "90d", "1y"] as RangeKey[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`btn ${range === r ? "btn-primary" : ""}`}
                        onClick={() => setRange(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hk-dashboard__chartTitle">{metricLabel(metric)} Trend</div>

                {loadingCharts ? (
                  <div className="hk-loading">Loading chart…</div>
                ) : !trend.length ? (
                  <div className="hk-dashboard__empty">No trend data available yet.</div>
                ) : (
                  <div className="hk-dashboard__chartWrap">
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={trend} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                       <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" />
<XAxis dataKey="label" stroke={chartText} tick={{ fill: chartText, fontSize: 12 }} />
<YAxis stroke={chartText} tick={{ fill: chartText, fontSize: 12 }} />
<Tooltip
contentStyle={{
background: "rgba(18, 22, 32, 0.96)",
border: "1px solid rgba(255,255,255,0.12)",
borderRadius: 12,
color: "#fff",
}}
labelStyle={{ color: "#fff", fontWeight: 800 }}
itemStyle={{ color: "#fff" }}
/>
<Area
type="monotone"
dataKey="value"
stroke={chartSecondary}
fill={chartSecondary}
fillOpacity={0.22}
/>
<Line
type="monotone"
dataKey="value"
stroke={chartPrimary}
strokeWidth={3}
dot={{ r: 3, fill: chartPrimary }}
activeDot={{ r: 5 }}
/>
                        <Line type="monotone" dataKey="value" stroke="#6fd3ff" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="hk-dashboard__panel hk-dashboard__panel--side">
                <div className="hk-dashboard__chartTitle">When Users Are Online Most</div>
                {loadingCharts ? (
                  <div className="hk-loading">Loading activity…</div>
                ) : !hourly.length ? (
                  <div className="hk-dashboard__empty">No activity data available yet.</div>
                ) : (
                  <>
                    <div className="hk-dashboard__activitySummary">
                      Strongest activity: <b>{topHour ? topHour.label : "—"}</b>
                    </div>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={hourly} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="hkHourFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#40d76b" stopOpacity={0.75} />
                            <stop offset="100%" stopColor="#40d76b" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="label" stroke="rgba(255,255,255,0.72)" tickLine={false} axisLine={false} />
                        <YAxis stroke="rgba(255,255,255,0.72)" tickLine={false} axisLine={false} width={44} />
                        <Tooltip
                          contentStyle={{
                            background: "rgba(16, 20, 28, 0.96)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: 10,
                            color: "#fff",
                          }}
                        />
                        <Area type="monotone" dataKey="value" stroke="#40d76b" fill="url(#hkHourFill)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
