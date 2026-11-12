// ai/app/page.js
"use client";

import { useState } from "react";
import axios from "axios";
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  ExternalLink,
  Bug,
  Eye,
} from "lucide-react";

export default function WebsiteQAAgent() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await axios.post("/api/qa", { targetUrl: url.trim() });
      setData(res.data);
    } catch (err) {
      const serverMsg = err.response?.data?.error || "Scan fail ho gaya. Dubara try karein.";
      const detailMsg = err.response?.data?.details ? ` (${err.response.data.details})` : "";
      setError(serverMsg + detailMsg);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      Critical: "bg-red-500/20 text-red-400 border-red-500/40",
      High: "bg-orange-500/20 text-orange-400 border-orange-500/40",
      Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
      Low: "bg-blue-500/20 text-blue-400 border-blue-500/40",
    };
    return styles[priority] || styles.Medium;
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-medium">
            <Bug className="w-3.5 h-3.5" /> Automated QA & SEO Auditor
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            AI Website QA Agent
          </h1>
          <p className="text-slate-400 text-sm md:text-base">
            Staging ya live URL dalein — agent broken links, missing images, SEO tags, aur UI/content issues scan karke Confirmed vs Suspected report banayega.
          </p>
        </div>

        {/* URL Input Form */}
        <form onSubmit={handleInspect} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              required
              placeholder="https://staging.yourwebsite.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl font-medium transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Inspecting Page...
              </>
            ) : (
              "Run QA Audit"
            )}
          </button>
        </form>

        {/* Error Box */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Report Section */}
        {data?.report && (
          <div className="space-y-8">
            {/* Score Summary Card */}
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <span>Inspected URL:</span>
                  <a
                    href={data.report.summary.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline inline-flex items-center gap-1"
                  >
                    {data.report.summary.url} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="text-lg font-medium text-slate-200">
                  {data.report.summary.verdict}
                </p>
                <p className="text-xs text-slate-500">
                  Checked {data.rawStats.linksChecked} links & {data.rawStats.imagesChecked} images live
                </p>
              </div>

              <div className="flex items-center gap-4 bg-slate-950 px-5 py-3 rounded-xl border border-slate-800">
                <div className="text-right">
                  <div className="text-xs text-slate-400 uppercase">QA Health Score</div>
                  <div className="text-2xl font-bold text-indigo-400">
                    {data.report.summary.overallScore}/100
                  </div>
                </div>
              </div>
            </div>

            {/* 1. CONFIRMED ISSUES */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-red-400">
                  <ShieldAlert className="w-5 h-5" />
                  Confirmed Issues ({data.report.confirmedIssues?.length || 0})
                </h2>
                <span className="text-xs text-slate-400">
                  100% Verified via HTTP Status & DOM Tags
                </span>
              </div>

              {data.report.confirmedIssues?.length === 0 ? (
                <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5" /> Koi confirmed technical error nahi mila!
                </div>
              ) : (
                <div className="grid gap-4">
                  {data.report.confirmedIssues.map((issue, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-xl bg-slate-900 border border-red-500/20 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-500">{issue.id}</span>
                          <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {issue.category}
                          </span>
                        </div>
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getPriorityBadge(
                            issue.priority
                          )}`}
                        >
                          {issue.priority}
                        </span>
                      </div>
                      <h3 className="font-semibold text-slate-100">{issue.title}</h3>
                      <p className="text-xs font-mono bg-slate-950 p-2.5 rounded-lg text-red-300 break-all">
                        Evidence: {issue.evidence}
                      </p>
                      <p className="text-sm text-slate-400">
                        <strong className="text-slate-200">Fix:</strong> {issue.fix}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* 2. SUSPECTED ISSUES */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  Suspected Issues ({data.report.suspectedIssues?.length || 0})
                </h2>
                <span className="text-xs text-slate-400">
                  AI-Flagged — Needs Visual / Manual Verification
                </span>
              </div>

              <div className="grid gap-4">
                {data.report.suspectedIssues?.map((issue, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-xl bg-slate-900 border border-amber-500/20 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">{issue.id}</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-md bg-slate-800 text-slate-300">
                          {issue.category}
                        </span>
                      </div>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${getPriorityBadge(
                          issue.priority
                        )}`}
                      >
                        {issue.priority}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-100">{issue.title}</h3>
                    <p className="text-sm text-slate-400">{issue.reasoning}</p>
                    <p className="text-xs text-amber-300/90 flex items-center gap-1.5 pt-1">
                      <Eye className="w-4 h-4 shrink-0" />
                      <span>Verify: {issue.howToVerify}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}