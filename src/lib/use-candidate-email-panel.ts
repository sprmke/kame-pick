import { useCallback, useEffect, useState } from 'react'
import { api, type EmailThread } from '#/lib/api'

type EmailPreview = {
  to_email: string;
  to_name: string;
  subject: string;
  body: string;
};

export function useCandidateEmailPanel(slug: string, analysisRunId?: number) {
  const [thread, setThread] = useState<EmailThread | null>(null)
  const [filterRunId, setFilterRunId] = useState<number | "all">(analysisRunId ?? "all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [placeholders, setPlaceholders] = useState<string[]>([
    "first_name",
    "name",
    "email",
    "role",
    "team_name",
  ]);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [error, setError] = useState("");
  const [gmailReady, setGmailReady] = useState<boolean | null>(null);
  const [sendMsg, setSendMsg] = useState("");

  const runIdForFetch = filterRunId === "all" ? undefined : filterRunId;

  const refreshThread = useCallback(async () => {
    setError("");
    try {
      const data = await api.candidateEmails(slug, runIdForFetch);
      setThread(data);
      if (data.default_subject) {
        setSubject(data.default_subject);
      }
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load emails");
      return null;
    }
  }, [slug, runIdForFetch]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [gmail, template, data] = await Promise.all([
          api.gmailStatus(),
          api.emailTemplate(),
          api.candidateEmails(slug, runIdForFetch),
        ]);
        if (cancelled) return;
        setGmailReady(gmail.ready);
        setPlaceholders(template.placeholders);
        setThread(data);
        if (data.default_subject) {
          setSubject(data.default_subject);
        }
        if (!data.has_outbound) {
          setBody(template.body);
        }
      } catch {
        if (!cancelled) setGmailReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, runIdForFetch]);

  async function showPreview() {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are required");
      return;
    }
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      const data = await api.previewCandidateEmail(slug, { subject, body, reply: true });
      setPreview(data);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function send() {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are required");
      return;
    }
    setSending(true);
    setError("");
    setSendMsg("");
    try {
      const res = await api.sendCandidateEmail(slug, {
        subject,
        body,
        analysis_run_id: filterRunId === "all" ? analysisRunId : filterRunId,
        reply: true,
      });
      if (!res.ok) {
        setError(res.error || "Send failed");
      } else {
        setSendMsg("Email sent — status set to shortlisted");
        setBody("");
        await refreshThread();
        await loadThread()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return {
    thread,
    filterRunId,
    setFilterRunId,
    subject,
    setSubject,
    body,
    setBody,
    placeholders,
    sending,
    previewOpen,
    setPreviewOpen,
    previewLoading,
    preview,
    previewError,
    error,
    gmailReady,
    sendMsg,
    showPreview,
    send,
  };
}
