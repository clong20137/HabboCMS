import React, { useEffect, useMemo, useState } from "react";
import { hkRequest } from "../../api/hkApi";

import editIcon from "../../assets/housekeeping/edit.png";
import deleteIcon from "../../assets/housekeeping/delete.png";

type WordFilterItem = {
  word: string;
  replacement: string;
  bannable: boolean;
  strict: boolean;
  addedby: string;
};

type ListResponse = {
  ok: boolean;
  total: number;
  items: WordFilterItem[];
  error?: string;
};

async function hkFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const method = String(opts?.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
    return hkRequest<T>(url.replace(/^\/api/, ""), opts);
  }

  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }

  return data as T;
}

export default function HKWordFilter() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [items, setItems] = useState<WordFilterItem[]>([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const limit = 50;

  // add form
  const [newWord, setNewWord] = useState("");
  const [newReplacement, setNewReplacement] = useState("");
  const [newBannable, setNewBannable] = useState(false);
  const [newStrict, setNewStrict] = useState(true);

  // edit modal state
  const [editing, setEditing] = useState<null | WordFilterItem>(null);
  const [editWord, setEditWord] = useState("");
  const [editReplacement, setEditReplacement] = useState("");
  const [editBannable, setEditBannable] = useState(false);
  const [editStrict, setEditStrict] = useState(true);

  const offset = useMemo(() => page * limit, [page]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      qs.set("limit", String(limit));
      qs.set("offset", String(offset));

      const data = await hkFetch<ListResponse>(
        `/api/hk/wordfilter?${qs.toString()}`,
      );
      setItems(data.items || []);
      setTotal(Number(data.total || 0));
    } catch (e: any) {
      setError(e?.message || "Failed to load wordfilter.");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  // reload on search with debounce-ish behavior
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openEdit = (it: WordFilterItem) => {
    setEditing(it);
    setEditWord(it.word);
    setEditReplacement(it.replacement || "");
    setEditBannable(Boolean(it.bannable));
    setEditStrict(Boolean(it.strict));
  };

  const closeEdit = () => {
    setEditing(null);
    setEditWord("");
    setEditReplacement("");
    setEditBannable(false);
    setEditStrict(true);
  };

  const onAdd = async () => {
    setSaving(true);
    setError("");
    try {
      await hkFetch<{ ok: boolean }>(`/api/hk/wordfilter`, {
        method: "POST",
        body: JSON.stringify({
          word: newWord.trim(),
          replacement: newReplacement,
          bannable: newBannable,
          strict: newStrict,
        }),
      });

      setNewWord("");
      setNewReplacement("");
      setNewBannable(false);
      setNewStrict(true);

      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add word.");
    } finally {
      setSaving(false);
    }
  };

  const onSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await hkFetch<{ ok: boolean }>(
        `/api/hk/wordfilter/${encodeURIComponent(editing.word)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            newWord: editWord.trim(),
            replacement: editReplacement,
            bannable: editBannable,
            strict: editStrict,
          }),
        },
      );

      closeEdit();
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update word.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (word: string) => {
    const ok = confirm(`Delete "${word}" from the wordfilter?`);
    if (!ok) return;

    setSaving(true);
    setError("");
    try {
      await hkFetch<{ ok: boolean }>(
        `/api/hk/wordfilter/${encodeURIComponent(word)}`,
        {
          method: "DELETE",
        },
      );
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to delete word.");
    } finally {
      setSaving(false);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const canPrev = page > 0;
  const canNext = page + 1 < pageCount;

  return (

      <div className="hk-wordfilter">
        <div className="panel">
          {/* HEADER */}
          <div className="panel-head">
            <div className="panel-title">Word Filter</div>
          </div>

          
          <div className="panel-body hk-wordfilter__searchRow">
            <input
              className="hk-input hk-wordfilter__search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search word, replacement, addedby..."
            />
          </div>

          <div className="panel-body">
            {error && <div className="hk-alert hk-alert--error">{error}</div>}

            {/* ADD */}
            <div className="hk-wordfilter__add panel">
       

              <div className="panel-body hk-wordfilter__addGrid">
                <div>
                  <label className="hk-label">Word</label>
                  <input
                    className="hk-input"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="word (primary key)"
                  />
                </div>

                <div>
                  <label className="hk-label">Replacement</label>
                  <input
                    className="hk-input"
                    value={newReplacement}
                    onChange={(e) => setNewReplacement(e.target.value)}
                    placeholder="replacement text (optional)"
                  />
                </div>

                <div className="hk-wordfilter__checks">
                  <label className="hk-check">
                    <input
                      type="checkbox"
                      checked={newBannable}
                      onChange={(e) => setNewBannable(e.target.checked)}
                    />
                    <span>Bannable</span>
                  </label>

                  <label className="hk-check">
                    <input
                      type="checkbox"
                      checked={newStrict}
                      onChange={(e) => setNewStrict(e.target.checked)}
                    />
                    <span>Strict</span>
                  </label>
                </div>

                <div className="hk-wordfilter__addActions">
                  <button
                    className="btn btn-primary"
                    disabled={saving || !newWord.trim()}
                    onClick={onAdd}
                  >
                    {saving ? "Saving..." : "Add Word"}
                  </button>
                </div>
              </div>
            </div>

            {/* LIST */}
            <div className="hk-wordfilter__tableWrap">
              <div className="hk-wordfilter__tableTop">
                <div className="hk-muted">
                  {loading ? "Loading..." : `${total} total`}
                </div>

                <div className="hk-wordfilter__pager">
                  <button
                    className="btn btn-secondary"
                    disabled={!canPrev || loading}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </button>
                  <div className="hk-muted">
                    Page {page + 1} / {pageCount}
                  </div>
                  <button
                    className="btn btn-secondary"
                    disabled={!canNext || loading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>

              
              <div className="hk-tableScroll">
                <div className="hk-table">
                  <div className="hk-table__row hk-table__row--head">
                    <div>Word</div>
                    <div>Replacement</div>
                    <div>Added By</div>
                    <div>Strict</div>
                    <div>Bannable</div>
                    <div className="hk-table__actionsHead">Actions</div>
                  </div>

                  {!loading && items.length === 0 && (
                    <div className="hk-table__empty">No results.</div>
                  )}

                  {items.map((it) => (
                    <div className="hk-table__row" key={it.word}>
                      <div className="hk-mono">{it.word}</div>
                      <div>
                        {it.replacement || <span className="hk-muted">—</span>}
                      </div>
                      <div>
                        {it.addedby || <span className="hk-muted">—</span>}
                      </div>
                      <div>{it.strict ? "Yes" : "No"}</div>
                      <div>{it.bannable ? "Yes" : "No"}</div>

                      
                      <div className="hk-table__actions">
                        <button
                          type="button"
                          className="hk-iconBtn"
                          onClick={() => openEdit(it)}
                          title="Edit"
                          aria-label={`Edit ${it.word}`}
                        >
                          <img src={editIcon} alt="" />
                        </button>

                        <button
                          type="button"
                          className="hk-iconBtn"
                          onClick={() => onDelete(it.word)}
                          title="Delete"
                          aria-label={`Delete ${it.word}`}
                        >
                          <img src={deleteIcon} alt="" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              
              {editing && (
                <div
                  className="hk-modalOverlay hk-show"
                  onMouseDown={closeEdit}
                >
                  <div
                    className="hk-modalWindow hk-show panel"
                    onMouseDown={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Edit Word"
                  >
                    <div className="panel-head hk-modalHead">
                      <div className="panel-title">Edit Word</div>
                      <button
                        className="hk-modalClose"
                        onClick={closeEdit}
                        type="button"
                      >
                        ×
                      </button>
                    </div>

                    <div className="panel-body hk-wordfilter__editGrid">
                      <div>
                        <label className="hk-label">Word</label>
                        <input
                          className="hk-input"
                          value={editWord}
                          onChange={(e) => setEditWord(e.target.value)}
                        />
                        <div className="hk-muted">
                          Changing this renames the primary key.
                        </div>
                      </div>

                      <div>
                        <label className="hk-label">Replacement</label>
                        <input
                          className="hk-input"
                          value={editReplacement}
                          onChange={(e) => setEditReplacement(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="hk-label">Added By (read-only)</label>
                        <input
                          className="hk-input"
                          value={editing.addedby || ""}
                          disabled
                        />
                      </div>

                      <div className="hk-wordfilter__checks">
                        <label className="hk-check">
                          <input
                            type="checkbox"
                            checked={editStrict}
                            onChange={(e) => setEditStrict(e.target.checked)}
                          />
                          <span>Strict</span>
                        </label>

                        <label className="hk-check">
                          <input
                            type="checkbox"
                            checked={editBannable}
                            onChange={(e) => setEditBannable(e.target.checked)}
                          />
                          <span>Bannable</span>
                        </label>
                      </div>

                      <div className="hk-wordfilter__editActions">
                        <button
                          className="btn btn-secondary"
                          onClick={closeEdit}
                          disabled={saving}
                          type="button"
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={onSaveEdit}
                          disabled={saving || !editWord.trim()}
                          type="button"
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* end tableWrap */}
          </div>
          {/* end panel-body */}
        </div>
      </div>

  );
}
