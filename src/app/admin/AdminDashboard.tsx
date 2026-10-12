"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AdminDocument = {
  id: number;
  title: string | null;
  country: string | null;
  category: string | null;
  source_url: string | null;
  verified: boolean;
  created_at: string;
};

type DocumentFields = {
  title: string;
  content: string;
  country: string;
  category: string;
  source_url: string;
};

type AdminDocumentDetail = AdminDocument & { content: string };

type SkippedRow = { row: number; reason: string };
type UploadResult = { inserted: number; skipped: SkippedRow[] };

type PublicSearchResult = { id: number; content: string; distance: number };
type AdminSearchResult = PublicSearchResult & { verified: boolean };

const PAGE_SIZE = 25;

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  // FastAPI validation errors put a list in `detail`, which isn't displayable.
  for (const message of [data?.error, data?.detail]) {
    if (typeof message === "string") return message;
  }
  return fallback;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [sessionExpired, setSessionExpired] = useState(false);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  // --- Upload panel ---
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      if (res.status === 401) setSessionExpired(true);
      if (!res.ok) {
        setUploadError(await errorMessage(res, "Upload failed."));
      } else {
        setUploadResult(await res.json());
        loadDocuments(0);
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // --- Documents table ---
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "true" | "false">("all");
  const [countryFilter, setCountryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  async function loadDocuments(nextOffset: number) {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await fetch(
        `/api/admin/documents?limit=${PAGE_SIZE}&offset=${nextOffset}`
      );
      if (res.status === 401) setSessionExpired(true);
      if (!res.ok) {
        setDocsError(await errorMessage(res, "Failed to load documents."));
        return;
      }
      const data: AdminDocument[] = await res.json();
      setDocuments(data);
      setHasMore(data.length === PAGE_SIZE);
      setOffset(nextOffset);
    } catch {
      setDocsError("Failed to load documents.");
    } finally {
      setDocsLoading(false);
    }
  }

  useEffect(() => {
    loadDocuments(0);
  }, []);

  // The backend's listing endpoint only supports limit/offset, so these
  // filters apply to the page that's currently loaded, not the whole table.
  const filteredDocuments = useMemo(() => {
    return documents.filter((d) => {
      if (verifiedFilter === "true" && !d.verified) return false;
      if (verifiedFilter === "false" && d.verified) return false;
      if (
        countryFilter &&
        (d.country ?? "").toLowerCase() !== countryFilter.toLowerCase()
      )
        return false;
      if (
        categoryFilter &&
        (d.category ?? "").toLowerCase() !== categoryFilter.toLowerCase()
      )
        return false;
      return true;
    });
  }, [documents, verifiedFilter, countryFilter, categoryFilter]);

  async function toggleVerified(doc: AdminDocument) {
    const next = !doc.verified;
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, verified: next } : d))
    );
    const res = await fetch(`/api/admin/documents/${doc.id}/verified`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: next }),
    });
    if (res.status === 401) setSessionExpired(true);
    if (!res.ok) {
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, verified: !next } : d))
      );
    }
  }

  // --- Edit and delete ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<DocumentFields | null>(null);
  const [editWasVerified, setEditWasVerified] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
    setEditError(null);
  }

  async function startEdit(doc: AdminDocument) {
    setConfirmDeleteId(null);
    setActionMessage(null);
    setActionError(null);
    setEditingId(doc.id);
    setEditForm(null);
    setEditError(null);
    setEditLoading(true);
    try {
      // The listing leaves out content, so fetch the full record.
      const res = await fetch(`/api/admin/documents/${doc.id}`);
      if (res.status === 401) setSessionExpired(true);
      if (!res.ok) {
        setEditError(await errorMessage(res, "Failed to load the document."));
        return;
      }
      const data: AdminDocumentDetail = await res.json();
      setEditForm({
        title: data.title ?? "",
        content: data.content,
        country: data.country ?? "",
        category: data.category ?? "",
        source_url: data.source_url ?? "",
      });
      setEditWasVerified(data.verified);
    } catch {
      setEditError("Failed to load the document.");
    } finally {
      setEditLoading(false);
    }
  }

  async function saveEdit() {
    if (editingId === null || !editForm) return;
    if (!editForm.content.trim()) {
      setEditError("Content can't be empty.");
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/documents/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.status === 401) setSessionExpired(true);
      if (!res.ok) {
        setEditError(await errorMessage(res, "Failed to save changes."));
        return;
      }
      const updated: AdminDocumentDetail = await res.json();
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === updated.id
            ? {
                id: updated.id,
                title: updated.title,
                country: updated.country,
                category: updated.category,
                source_url: updated.source_url,
                verified: updated.verified,
                created_at: updated.created_at,
              }
            : d
        )
      );
      setActionMessage(
        editWasVerified && !updated.verified
          ? `Saved document ${updated.id}. It's now unverified until it's reviewed again.`
          : `Saved document ${updated.id}.`
      );
      cancelEdit();
    } catch {
      setEditError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument(doc: AdminDocument) {
    setDeletingId(doc.id);
    setActionMessage(null);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/documents/${doc.id}`, {
        method: "DELETE",
      });
      if (res.status === 401) setSessionExpired(true);
      if (!res.ok) {
        setActionError(await errorMessage(res, "Failed to delete the document."));
        return;
      }
      if (editingId === doc.id) cancelEdit();
      setConfirmDeleteId(null);
      setActionMessage(`Deleted "${doc.title ?? `document ${doc.id}`}".`);
      // Reload so the page refills; step back if this emptied the last page.
      loadDocuments(
        documents.length === 1 && offset > 0 ? offset - PAGE_SIZE : offset
      );
    } catch {
      setActionError("Failed to delete the document.");
    } finally {
      setDeletingId(null);
    }
  }

  // --- Test search panel ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchView, setSearchView] = useState<"public" | "admin">("public");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [publicResults, setPublicResults] = useState<PublicSearchResult[]>([]);
  const [adminResults, setAdminResults] = useState<AdminSearchResult[]>([]);

  async function runSearch() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    try {
      const url =
        searchView === "public"
          ? `/api/search?query=${encodeURIComponent(searchQuery)}`
          : `/api/admin/search?query=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (res.status === 401) setSessionExpired(true);
      if (!res.ok) {
        setSearchError(await errorMessage(res, "Search failed."));
        return;
      }
      const data = await res.json();
      if (searchView === "public") {
        setPublicResults(data);
      } else {
        setAdminResults(data);
      }
    } catch {
      setSearchError("Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  if (sessionExpired) {
    return (
      <main className="max-w-2xl mx-auto p-8 space-y-4">
        <p>Your session has expired.</p>
        <a href="/admin/login" className="underline">
          Log in again
        </a>
      </main>
    );
  }

  const results = searchView === "public" ? publicResults : adminResults;

  return (
    <main className="max-w-4xl mx-auto p-8 space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin</h1>
        <button onClick={logout} className="text-sm underline">
          Log out
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="font-semibold">Upload documents</h2>
        <p className="text-sm text-gray-500">
          Uploaded rows arrive unverified. Verify them in the table below once
          reviewed.
        </p>
        <div className="flex gap-2 items-center">
          <input
            type="file"
            accept=".csv,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
        {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        {uploadResult && (
          <div className="text-sm space-y-2">
            <p>Inserted: {uploadResult.inserted}</p>
            {uploadResult.skipped.length > 0 && (
              <table className="w-full border text-left">
                <thead>
                  <tr>
                    <th className="border p-1">Row</th>
                    <th className="border p-1">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadResult.skipped.map((s) => (
                    <tr key={s.row}>
                      <td className="border p-1">{s.row}</td>
                      <td className="border p-1">{s.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Documents</h2>
        <div className="flex gap-2 flex-wrap">
          <select
            value={verifiedFilter}
            onChange={(e) =>
              setVerifiedFilter(e.target.value as "all" | "true" | "false")
            }
            className="border rounded p-2"
          >
            <option value="all">All</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <input
            placeholder="Country"
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="border rounded p-2"
          />
          <input
            placeholder="Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border rounded p-2"
          />
        </div>

        {actionMessage && (
          <p role="status" className="text-sm text-green-700">
            {actionMessage}
          </p>
        )}
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        {docsLoading && <p>Loading...</p>}
        {docsError && <p className="text-sm text-red-600">{docsError}</p>}

        {!docsLoading && !docsError && (
          <>
            <table className="w-full border text-left text-sm">
              <thead>
                <tr>
                  <th className="border p-1">Title</th>
                  <th className="border p-1">Country</th>
                  <th className="border p-1">Category</th>
                  <th className="border p-1">Source</th>
                  <th className="border p-1">Created</th>
                  <th className="border p-1">Verified</th>
                  <th className="border p-1">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((d) => (
                  <Fragment key={d.id}>
                    <tr>
                      <td className="border p-1">{d.title ?? "—"}</td>
                      <td className="border p-1">{d.country ?? "—"}</td>
                      <td className="border p-1">{d.category ?? "—"}</td>
                      <td className="border p-1">
                        {d.source_url ? (
                          <a
                            href={d.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            link
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="border p-1">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="border p-1">
                        <button
                          onClick={() => toggleVerified(d)}
                          className="underline"
                        >
                          {d.verified ? "Verified" : "Unverified"}
                        </button>
                      </td>
                      <td className="border p-1 whitespace-nowrap">
                        {confirmDeleteId === d.id ? (
                          <span className="flex gap-2 items-center">
                            <span>Delete permanently?</span>
                            <button
                              onClick={() => deleteDocument(d)}
                              disabled={deletingId === d.id}
                              className="bg-red-600 text-white px-2 py-0.5 rounded disabled:opacity-50"
                            >
                              {deletingId === d.id ? "Deleting..." : "Yes, delete"}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              disabled={deletingId === d.id}
                              className="underline"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="flex gap-3">
                            <button
                              onClick={() =>
                                editingId === d.id ? cancelEdit() : startEdit(d)
                              }
                              className="underline"
                            >
                              {editingId === d.id ? "Close" : "Edit"}
                            </button>
                            <button
                              onClick={() => {
                                setActionMessage(null);
                                setActionError(null);
                                setConfirmDeleteId(d.id);
                              }}
                              className="underline text-red-600"
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                    {editingId === d.id && (
                      <tr>
                        <td colSpan={7} className="border p-3 bg-gray-50">
                          {editLoading && <p>Loading document...</p>}
                          {editForm && (
                            <EditDocumentForm
                              id={d.id}
                              form={editForm}
                              wasVerified={editWasVerified}
                              saving={saving}
                              onChange={setEditForm}
                              onSave={saveEdit}
                              onCancel={cancelEdit}
                            />
                          )}
                          {editError && (
                            <p className="text-sm text-red-600 mt-2">{editError}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <button
                onClick={() => loadDocuments(Math.max(0, offset - PAGE_SIZE))}
                disabled={offset === 0}
                className="border px-3 py-1 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => loadDocuments(offset + PAGE_SIZE)}
                disabled={!hasMore}
                className="border px-3 py-1 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Test search</h2>
        <div className="flex gap-2">
          <input
            className="flex-1 border rounded p-2"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
          />
          <select
            value={searchView}
            onChange={(e) =>
              setSearchView(e.target.value as "public" | "admin")
            }
            className="border rounded p-2"
          >
            <option value="public">Public view</option>
            <option value="admin">Admin view</option>
          </select>
          <button
            onClick={runSearch}
            className="bg-black text-white px-4 py-2 rounded"
          >
            Search
          </button>
        </div>

        {searchLoading && <p>Searching...</p>}
        {searchError && <p className="text-sm text-red-600">{searchError}</p>}

        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id} className="border rounded p-3">
              <p>{r.content}</p>
              <p className="text-sm text-gray-500">
                distance: {r.distance.toFixed(4)}
                {"verified" in r && (
                  <span
                    className={`ml-2 ${
                      r.verified ? "text-green-600" : "text-yellow-600"
                    }`}
                  >
                    {r.verified ? "verified" : "unverified"}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

const EDIT_FIELDS: { key: Exclude<keyof DocumentFields, "content">; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "country", label: "Country" },
  { key: "category", label: "Category" },
  { key: "source_url", label: "Source URL" },
];

function EditDocumentForm({
  id,
  form,
  wasVerified,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  id: number;
  form: DocumentFields;
  wasVerified: boolean;
  saving: boolean;
  onChange: (form: DocumentFields) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="space-y-3"
    >
      <p className="text-sm text-gray-600">
        {wasVerified
          ? "This document is verified. Changing its title, content or source URL will mark it unverified, removing it from public search and the checklist until it's verified again."
          : "Changing the title or content re-computes the document's search embedding."}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EDIT_FIELDS.map(({ key, label }) => (
          <label key={key} className="block text-sm space-y-1">
            <span className="font-medium">{label}</span>
            <input
              value={form[key]}
              onChange={(e) => onChange({ ...form, [key]: e.target.value })}
              className="w-full border rounded p-2 bg-white"
            />
          </label>
        ))}
      </div>
      <p className="text-xs text-gray-500">
        The UK import checklist finds its sources by exact title, so renaming a
        source document drops the matching check.
      </p>
      <label className="block text-sm space-y-1">
        <span className="font-medium">Content</span>
        <textarea
          value={form.content}
          onChange={(e) => onChange({ ...form, content: e.target.value })}
          rows={8}
          required
          className="w-full border rounded p-2 bg-white font-mono text-xs"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {saving ? "Saving..." : `Save document ${id}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="border px-4 py-2 rounded"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
