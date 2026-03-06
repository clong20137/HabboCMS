import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { useNavigate, useParams } from "react-router-dom";
import SiteLayout from "../components/layout/SiteLayout";
import { useAuth } from "../auth/AuthContext";
import {
  api,
  type NewsComment,
  type NewsItem,
  type NewsDetail,
} from "../api/client";
import "../styles/news.scss";

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

const COMMENT_COOLDOWN_MS = 5 * 60 * 1000;

function fmtCountdown(msLeft: number) {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

export default function NewsStoryPage() {
  const nav = useNavigate();
  const { id } = useParams();
  const newsId = Number(id);

  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<NewsDetail | null>(null);
  const [recent, setRecent] = useState<NewsItem[]>([]);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canComment = !!user;

  const COOLDOWN_KEY = useMemo(() => {
    const uid = user?.id ?? 0;
    return `news_comment_cooldown_until:${uid}:${newsId}`;
  }, [user?.id, newsId]);

  const [cooldownUntil, setCooldownUntil] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(COOLDOWN_KEY);
      const n = raw ? Number(raw) : 0;
      return Number.isFinite(n) ? n : 0;
    } catch {
      return 0;
    }
  });
  const [cooldownText, setCooldownText] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COOLDOWN_KEY);
      const n = raw ? Number(raw) : 0;
      setCooldownUntil(Number.isFinite(n) ? n : 0);
    } catch {
      setCooldownUntil(0);
    }
  }, [COOLDOWN_KEY]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        if (!Number.isFinite(newsId) || newsId <= 0)
          throw new Error("Invalid story id.");

        const [s, r, c] = await Promise.all([
          api.getNewsById(newsId),
          api.getRecentNews(newsId, 6),
          api.getNewsComments(newsId),
        ]);

        if (!alive) return;
        setStory(s);
        setRecent(r);
        setComments(c);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load story.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [newsId]);

  useEffect(() => {
    if (!cooldownUntil) return;

    const t = window.setInterval(() => {
      const left = cooldownUntil - Date.now();

      if (left <= 0) {
        setCooldownUntil(0);
        try {
          localStorage.removeItem(COOLDOWN_KEY);
        } catch {}
        setCooldownText("");
        window.clearInterval(t);
        return;
      }

      setCooldownText(`You can comment again in ${fmtCountdown(left)}`);
    }, 250);

    const left = cooldownUntil - Date.now();
    if (left > 0)
      setCooldownText(`You can comment again in ${fmtCountdown(left)}`);
  const safeStoryHtml = useMemo(() => {
    const html = story?.story || "";
    return DOMPurify.sanitize(html, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["script", "style"],
      FORBID_ATTR: ["onerror", "onload"],
    });
  }, [story?.story]);


    return () => window.clearInterval(t);
  }, [cooldownUntil, COOLDOWN_KEY]);

  const metaText = useMemo(() => {
    if (!story) return "";
    const d = fmtDate(story.createdAt);
    return `${story.author}${d ? ` • ${d}` : ""}`;
  }, [story]);

  const isCooldownActive = canComment && cooldownUntil > Date.now();

  async function submitComment() {
    const body = commentBody.trim();
    if (!body) return;

    if (!canComment) {
      alert("You must be logged in to comment.");
      return;
    }

    if (isCooldownActive) {
      alert(cooldownText || "Please wait before commenting again.");
      return;
    }

    try {
      setPosting(true);

      const posted = await api.postNewsComment(newsId, body);

      setComments((prev) => [posted, ...prev]);
      setCommentBody("");

      const until = Date.now() + COMMENT_COOLDOWN_MS;
      setCooldownUntil(until);
      try {
        localStorage.setItem(COOLDOWN_KEY, String(until));
      } catch {}
    } catch (e: any) {
      const msg = e?.message || "Failed to post comment.";
      alert(msg);

      if (String(msg).toLowerCase().includes("wait")) {
        const until = Date.now() + COMMENT_COOLDOWN_MS;
        setCooldownUntil(until);
        try {
          localStorage.setItem(COOLDOWN_KEY, String(until));
        } catch {}
      }
    } finally {
      setPosting(false);
    }
  }

  async function toggleReaction(
    commentId: number,
    reaction: "thumbs_up" | "smile",
  ) {
    if (!canComment) {
      alert("You must be logged in to react.");
      return;
    }

    try {
      const r = await api.toggleCommentReaction(commentId, reaction);

      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, reactions: r.reactions, myReactions: r.myReactions }
            : c,
        ),
      );
    } catch (e: any) {
      alert(e?.message || "Failed to react.");
    }
  }

  return (
    <SiteLayout active="home">
      <div className="news-page">
        <div className="news-layout">
          <section className="panel news-main">
            <div className="panel-head">NEWS</div>

            <div className="panel-body">
              {loading ? (
                <div className="muted">Loading...</div>
              ) : error ? (
                <div className="muted">{error}</div>
              ) : !story ? (
                <div className="muted">Story not found.</div>
              ) : (
                <>
                  <div className="news-hero">
                    <img
                      className="news-hero-img"
                      src={story.imageUrl}
                      alt={story.title}
                    />
                  </div>

                  <h1 className="news-h1">{story.title}</h1>

                  <div
                    className="news-story"
                    dangerouslySetInnerHTML={{ __html: story }}
                  />

                  <div className="news-footer">
                    <div className="news-meta">{metaText}</div>
                  </div>

                  <div className="news-comments">
                    <div className="news-comments-head">Comments</div>

                    {!canComment ? (
                      <div className="muted">
                        You must be logged in to comment.
                      </div>
                    ) : (
                      <div className="news-comment-box">
                        <textarea
                          className="news-comment-input"
                          placeholder="Write a comment..."
                          value={commentBody}
                          onChange={(e) => setCommentBody(e.target.value)}
                          rows={3}
                          disabled={posting || isCooldownActive}
                        />

                        {isCooldownActive && (
                          <div className="muted" style={{ marginTop: 6 }}>
                            {cooldownText ||
                              "Please wait before commenting again."}
                          </div>
                        )}

                        <button
                          className="btn btn-primary"
                          type="button"
                          disabled={
                            posting ||
                            isCooldownActive ||
                            commentBody.trim().length < 2
                          }
                          onClick={submitComment}
                          style={{ marginTop: 10 }}
                        >
                          {posting ? "Posting..." : "Post Comment"}
                        </button>
                      </div>
                    )}

                    <div className="news-comment-list">
                      {comments.length === 0 ? (
                        <div className="muted">No comments yet.</div>
                      ) : (
                        comments.map((c) => {
                          const thumbsUpCount = Number(
                            c.reactions?.thumbs_up ?? 0,
                          );
                          const smileCount = Number(c.reactions?.smile ?? 0);
                          const my = Array.isArray(c.myReactions)
                            ? c.myReactions
                            : [];
                          const hasThumbsUp = my.includes("thumbs_up");
                          const hasSmile = my.includes("smile");

                          return (
                            <div className="news-comment" key={c.id}>
                              <div className="news-comment-top">
                                <div className="news-comment-user">
                                  {c.username}
                                </div>
                                <div className="news-comment-date muted">
                                  {fmtDate(c.createdAt)}
                                </div>
                              </div>

                              <div className="news-comment-body">{c.body}</div>

                              <div className="comment-actions">
                                <button
                                  type="button"
                                  className={`react-btn ${hasThumbsUp ? "active" : ""}`}
                                  onClick={() =>
                                    toggleReaction(c.id, "thumbs_up")
                                  }
                                >
                                  👍 <span>{thumbsUpCount}</span>
                                </button>

                                <button
                                  type="button"
                                  className={`react-btn ${hasSmile ? "active" : ""}`}
                                  onClick={() => toggleReaction(c.id, "smile")}
                                >
                                  😊 <span>{smileCount}</span>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* RIGHT SIDEBAR */}
          <aside className="panel news-side recent-news-panel">
            <div className="panel-head">RECENT NEWS</div>
            <div className="panel-body">
              {recent.length === 0 ? (
                <div className="muted">No recent articles.</div>
              ) : (
                <div className="recent-list">
                  {recent.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      className="recent-item"
                      onClick={() => nav(`/news/${n.id}`)}
                    >
                      <div className="recent-thumb">
                        <img src={n.imageUrl} alt={n.title} />
                      </div>
                      <div className="recent-info">
                        <div className="recent-title">{n.title}</div>
                        <div className="recent-meta muted">
                          {n.author} • {fmtDate(n.createdAt)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
