import type { ReactNode } from "react";

export default function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div>
        <div className="atom-head">
          <div className="atom-badge">⚚</div>
          <div>
            <div className="atom-title">{title}</div>
            {subtitle && <div className="atom-sub">{subtitle}</div>}
          </div>
        </div>
        <div className="atom-body">{children}</div>
      </div>
    </div>
  );
}
