import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type NewsImagesResponse = {
  ok: boolean;
  items: { name: string; url: string }[];
};

function getCookie(name: string) {
const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
return m ? decodeURIComponent(m[2]) : "";
}

async function hkFetch<T>(url: string, opts: RequestInit = {}): Promise<T> {
const method = (opts.method || "GET").toUpperCase();
const isMutation = !["GET", "HEAD", "OPTIONS"].includes(method);

const csrf = isMutation ? getCookie("pluscsrf") : "";

const headers = new Headers(opts.headers || {});
// Only set JSON header if we're sending a JSON body
if (opts.body && !headers.has("Content-Type")) {
headers.set("Content-Type", "application/json");
}
if (isMutation && csrf) {
headers.set("X-CSRF-Token", csrf);
}

const res = await fetch(url, {
credentials: "include",
...opts,
headers,
});

const data = await res.json().catch(() => ({}));
if (!res.ok) {
throw new Error((data as any)?.error || (data as any)?.message || "Request failed");
}
return data as T;
}
// Base path (supports hosting under /web)
const APP_BASE =
  (import.meta as any).env?.BASE_URL || (process as any).env?.PUBLIC_URL || "/";

function withBase(url: string) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const u = url.startsWith("/") ? url : `/${url}`;
  const b = APP_BASE.endsWith("/") ? APP_BASE.slice(0, -1) : APP_BASE;
  return `${b}${u}`;
}

// Make image URLs bulletproof:
// - accepts "/assets/news/x.png"
// - accepts "x.png"
// - accepts "public/assets/news/x.png"
// - accepts "C:\...\public\assets\news\x.png"
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

export default function HKNewsNew() {
  const nav = useNavigate();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // HTML editor output
  const [storyHtml, setStoryHtml] = useState("<p></p>");

  // store image as either filename OR /assets/news/filename (server normalizes)
  const [imageUrl, setImageUrl] = useState("");

  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [imgOpen, setImgOpen] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [ok, setOk] = useState<string>("");

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");

    if (!title.trim()) return setError("Title is required.");

    const trimmedStory = (storyHtml || "").trim();
    if (!trimmedStory || trimmedStory === "<p></p>")
      return setError("Story is required.");

    setSaving(true);
    try {
      const res = await hkFetch<{ ok: boolean; id: number }>("/api/hk/news", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          storyHtml: trimmedStory,
          imageUrl: imageUrl.trim(),
        }),
      });

      setOk("Article created.");
      nav(`/housekeeping/news/edit/${res.id}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create.");
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = imageUrl ? withBase(resolveNewsAsset(imageUrl)) : "";

  return (
    <div className="panel hk-news">
      <div className="panel-head">New Article</div>

      <div className="panel-body">
        {error && <div className="hk-alert--error">{error}</div>}
        {ok && <div className="hk-alert--ok">{ok}</div>}

        <form onSubmit={submit} className="hk-news__form">
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
                placeholder="Short summary shown in lists (optional)"
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

            <div className="hk-news__actions">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </form>

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
                          // store the url returned by server (server normalizes to filename)
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
