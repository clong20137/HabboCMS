import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

type NewsItem = {
  id: number;
  title: string;
  description: string;
  story: string;
  storyHtml: string;
  imageUrl: string;
  author: string;
  createdAt: string;
};

type GetResponse = { ok: boolean; item: NewsItem };
type NewsImagesResponse = {
  ok: boolean;
  items: { name: string; url: string }[];
};

async function hkFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      (data as any)?.error || (data as any)?.message || "Request failed",
    );
  return data as T;
}

const APP_BASE =
  (import.meta as any).env?.BASE_URL || (process as any).env?.PUBLIC_URL || "/";

function withBase(url: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const u = url.startsWith("/") ? url : `/${url}`;
  const b = APP_BASE.endsWith("/") ? APP_BASE.slice(0, -1) : APP_BASE;
  return `${b}${u}`;
}

function resolveNewsAsset(rawInput: string) {
  const raw = (rawInput || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const winFile = raw.split("\\").pop() || raw;
  const noPublic = winFile.replace(/^\/?public\//i, "");
  if (noPublic.startsWith("/")) return noPublic;
  if (noPublic.includes("/assets/news/"))
    return `/${noPublic.replace(/^\/+/, "")}`;
  return `/assets/news/${noPublic}`;
}

/**
 * Simple replacement for TipTap:
 * - stores raw HTML string in state
 * - user can paste HTML or write basic tags
 */
function BasicHtmlTextareaEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="hk-editor">
      <textarea
        className="hk-input"
        style={{
          width: "100%",
          minHeight: 260,
          padding: 10,
          fontFamily: "monospace",
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="<p>Write your story here...</p>"
      />
      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
        This field accepts HTML (example: <code>{`<p>Text</p>`}</code>).
      </div>
    </div>
  );
}

export default function HKNewsEdit() {
  const { id: idParam } = useParams();
  const id = useMemo(() => Number(idParam), [idParam]);
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [storyHtml, setStoryHtml] = useState("<p></p>");

  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [imgOpen, setImgOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await hkFetch<GetResponse>(`/api/hk/news/${id}`);
      setTitle(data.item.title || "");
      setDescription(data.item.description || "");
      setImageUrl(data.item.imageUrl || "");
      setStoryHtml(data.item.storyHtml || data.item.story || "<p></p>");
    } catch (e: any) {
      setError(e?.message || "Failed to load article.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const data = await hkFetch<NewsImagesResponse>("/api/hk/news/images");
        setImages(Array.isArray(data.items) ? data.items : []);
      } catch {
        setImages([]);
      }
    })();
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await hkFetch(`/api/hk/news/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          storyHtml: storyHtml.trim(),
          imageUrl: imageUrl.trim(),
        }),
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = imageUrl ? withBase(resolveNewsAsset(imageUrl)) : "";

  if (!Number.isFinite(id) || id <= 0) {
    return (
      <div className="panel hk-news">
        <div className="panel-head">Edit Article</div>
        <div className="panel-body">
          <div className="hk-alert hk-alert--error">Invalid article id.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel hk-news">
      <div className="panel-head">Edit Article</div>

      <div className="panel-body">
        {error && <div className="hk-alert hk-alert--error">{error}</div>}

        {loading ? (
          <div className="hk-loading">Loading…</div>
        ) : (
          <div className="hk-news__grid">
            <div className="hk-field">
              <div className="hk-label">Title</div>
              <input
                className="hk-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="hk-field">
              <div className="hk-label">Description</div>
              <input
                className="hk-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="hk-field">
              <div className="hk-label">Image</div>

              <div className="hk-newsImgPick">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setImgOpen(true)}
                  disabled={saving}
                >
                  Choose Image
                </button>

                <div className="hk-newsImgPick__value">
                  {imageUrl || "None selected"}
                </div>
              </div>

              {imageUrl && (
                <div className="hk-newsImgPreview">
                  <img
                    src={previewSrc}
                    alt=""
                    onError={(e) => {
                      e.currentTarget.style.opacity = "0.2";
                    }}
                  />
                </div>
              )}
            </div>

            <div className="hk-field hk-news__body">
              <div className="hk-label">Story</div>
              <BasicHtmlTextareaEditor
                value={storyHtml}
                onChange={setStoryHtml}
                disabled={saving}
              />
            </div>

            <div
              className="hk-news__actions"
              style={{ display: "flex", gap: 10 }}
            >
              <button
                className="btn btn-primary"
                type="button"
                onClick={save}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => nav("/housekeeping/news")}
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Image picker modal */}
        {imgOpen && (
          <div
            className="hk-modal-backdrop"
            onMouseDown={() => setImgOpen(false)}
          >
            <div className="hk-modal" onMouseDown={(e) => e.stopPropagation()}>
              <div className="panel-head">Select News Image</div>
              <div className="panel-body">
                <div className="hk-newsImgGrid">
                  {images.map((img) => {
                    const src = withBase(resolveNewsAsset(img.url));
                    return (
                      <button
                        key={img.name}
                        type="button"
                        className="hk-newsImgCell"
                        onClick={() => {
                          setImageUrl(img.url);
                          setImgOpen(false);
                        }}
                      >
                        <img
                          src={src}
                          alt={img.name}
                          onError={(e) => {
                            e.currentTarget.style.opacity = "0.2";
                          }}
                        />
                        <div className="hk-newsImgName">{img.name}</div>
                      </button>
                    );
                  })}

                  {!images.length && (
                    <div style={{ fontWeight: 900, opacity: 0.85 }}>
                      No images found in /public/assets/news
                    </div>
                  )}
                </div>

                <div className="hk-newsImgActions">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setImgOpen(false)}
                  >
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => {
                      setImageUrl("");
                      setImgOpen(false);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
