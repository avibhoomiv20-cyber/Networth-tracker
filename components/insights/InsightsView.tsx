"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CircleHelp,
  Database,
  MessageCircle,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  buildInsightBriefing,
  type InsightRange,
} from "@/lib/insights";
import { formatMonth } from "@/lib/tracker";
import { getSupabaseClient } from "@/lib/supabase/client";
import type {
  AIChatMessage,
  FinancialInsight,
  TrackerData,
} from "@/lib/types";

type InsightsViewProps = {
  userId: string;
  workspaceId: string;
  data: TrackerData;
  selectedMonth: string;
  refreshedAt: Date | null;
};

const rangeOptions: Array<{ value: InsightRange; label: string }> = [
  { value: 1, label: "This month" },
  { value: 3, label: "3 months" },
  { value: 12, label: "1 year" },
];

const suggestedQuestions = [
  "What changed in my net worth?",
  "Review my asset concentration.",
  "How healthy is my liquidity?",
];

export function InsightsView({
  userId,
  workspaceId,
  data,
  selectedMonth,
  refreshedAt,
}: InsightsViewProps) {
  const [range, setRange] = useState<InsightRange>(1);
  const [mobilePanel, setMobilePanel] = useState<"briefing" | "chat">(
    "briefing",
  );
  const [seedRequest, setSeedRequest] = useState({ id: 0, question: "" });
  const briefing = useMemo(
    () => buildInsightBriefing(data, selectedMonth, range),
    [data, range, selectedMonth],
  );

  if (!briefing) {
    return (
      <section className="insights-empty">
        <Sparkles size={24} />
        <h2>No insight-ready values for {formatMonth(selectedMonth)}</h2>
        <p>
          Add holdings for this month or choose a recorded month. Insights only
          use values that are present in your portfolio.
        </p>
      </section>
    );
  }

  const askAbout = (question: string) => {
    setSeedRequest((current) => ({
      id: current.id + 1,
      question,
    }));
    setMobilePanel("chat");
  };

  return (
    <div className="insights-shell">
      <div className="insights-toolbar">
        <div className="range-selector" aria-label="Insight comparison period">
          {rangeOptions.map((option) => (
            <button
              className={range === option.value ? "active" : ""}
              key={option.value}
              onClick={() => setRange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="data-freshness">
          <Database size={14} />
          {refreshedAt
            ? `Data refreshed ${formatRelativeTime(refreshedAt)}`
            : "Using data from your portfolio"}
        </span>
      </div>

      <div className="insights-mobile-tabs" role="tablist" aria-label="Insights">
        <button
          aria-selected={mobilePanel === "briefing"}
          className={mobilePanel === "briefing" ? "active" : ""}
          onClick={() => setMobilePanel("briefing")}
          role="tab"
          type="button"
        >
          Briefing
        </button>
        <button
          aria-selected={mobilePanel === "chat"}
          className={mobilePanel === "chat" ? "active" : ""}
          onClick={() => setMobilePanel("chat")}
          role="tab"
          type="button"
        >
          Ask AI
        </button>
      </div>

      <div className="insights-grid">
        <section
          className={`insight-briefing ${
            mobilePanel !== "briefing" ? "mobile-hidden" : ""
          }`}
        >
          <div className="briefing-heading">
            <div>
              <p className="eyebrow">Portfolio insights</p>
              <h2>{formatMonth(briefing.monthId)}</h2>
              <p>
                Deterministic observations calculated from your synced records.
              </p>
            </div>
            <span>{briefing.insights.length} observations</span>
          </div>
          <div className="insight-card-list">
            {briefing.insights.map((item) => (
              <InsightCard item={item} key={item.id} onAsk={askAbout} />
            ))}
          </div>
          <p className="insight-disclaimer">
            These observations organise your records and are not investment,
            tax, or legal advice.
          </p>
        </section>

        <section
          className={`assistant-column ${
            mobilePanel !== "chat" ? "mobile-hidden" : ""
          }`}
        >
          <AssistantPanel
            key={`${workspaceId}-${seedRequest.id}`}
            userId={userId}
            workspaceId={workspaceId}
            selectedMonth={selectedMonth}
            seedQuestion={seedRequest.question}
            sources={[
              `${data.accounts.length} accounts`,
              `${data.snapshots.length} snapshots`,
              `${data.entries.length} account-book entries`,
              formatMonth(selectedMonth),
            ]}
          />
        </section>
      </div>
    </div>
  );
}

function InsightCard({
  item,
  onAsk,
}: {
  item: FinancialInsight;
  onAsk: (question: string) => void;
}) {
  return (
    <article className={`insight-card tone-${item.tone}`}>
      <div className="insight-icon" aria-hidden="true">
        {item.tone === "attention" ? (
          <AlertTriangle size={18} />
        ) : (
          <Sparkles size={18} />
        )}
      </div>
      <div className="insight-copy">
        <p className="insight-eyebrow">{item.eyebrow}</p>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <strong className="insight-impact">{item.impact}</strong>
        <details>
          <summary>
            <CircleHelp size={14} /> Why am I seeing this?
          </summary>
          <p>{item.why}</p>
          <span>Source: {item.source}</span>
        </details>
        <div className="insight-actions">
          <button onClick={() => onAsk(item.question)} type="button">
            <MessageCircle size={14} /> Ask about this
          </button>
        </div>
      </div>
    </article>
  );
}

function AssistantPanel({
  userId,
  workspaceId,
  selectedMonth,
  seedQuestion,
  sources,
}: {
  userId: string;
  workspaceId: string;
  selectedMonth: string;
  seedQuestion: string;
  sources: string[];
}) {
  const storageKey = `networth-ai-history-v2-${userId}-${workspaceId}`;
  const [messages, setMessages] = useState<AIChatMessage[]>(() =>
    loadStoredMessages(storageKey),
  );
  const [question, setQuestion] = useState(seedQuestion);
  const [aiEnabled, setAIEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem("networth-ai-opt-in") === "true",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(messages.slice(-20)),
      );
    } else {
      window.localStorage.removeItem(storageKey);
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, storageKey]);

  const submit = async (prompt = question) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || loading || !aiEnabled) return;

    const userMessage: AIChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: cleanPrompt,
      createdAt: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMessage].slice(-12);
    setMessages(nextHistory);
    setQuestion("");
    setError("");
    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Cloud connection is unavailable.");
      const { data, error: invokeError } = await supabase.functions.invoke<{
        answer?: string;
        error?: string;
      }>("networth-ai-chat", {
        body: {
          message: cleanPrompt,
          workspaceId,
          history: messages
            .slice(-10)
            .map(({ role, content }) => ({ role, content })),
          selectedMonth,
        },
      });
      if (invokeError) {
        throw new Error(await readFunctionError(invokeError));
      }
      if (!data?.answer) {
        throw new Error(data?.error ?? "The assistant returned no answer.");
      }
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.answer!,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The assistant is temporarily unavailable.",
      );
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setError("");
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-heading">
        <div className="assistant-title">
          <span>
            <Sparkles size={17} />
          </span>
          <div>
            <h2>Ask AssetTracker AI</h2>
            <p>Based on your selected portfolio month</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            aria-label="Clear conversation"
            className="icon-button"
            onClick={clearConversation}
            type="button"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <label className="ai-consent">
        <input checked={aiEnabled} onChange={(event) => {
          setAIEnabled(event.target.checked);
          window.localStorage.setItem("networth-ai-opt-in", String(event.target.checked));
        }} type="checkbox" />
        <span>I agree to send anonymized, selected-period aggregates to the AI provider.</span>
      </label>

      <div className="assistant-sources">
        {sources.map((source) => (
          <span key={source}>{source}</span>
        ))}
      </div>

      <div className="chat-transcript" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <Sparkles size={22} />
            <h3>Explore your portfolio</h3>
            <p>
              Ask for explanations and comparisons. Calculations stay grounded
              in your Supabase records.
            </p>
            <div className="suggested-questions">
              {suggestedQuestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => void submit(suggestion)}
                  type="button"
                >
                  {suggestion} <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div className={`chat-message ${message.role}`} key={message.id}>
              <span>{message.role === "user" ? "You" : "AssetTracker AI"}</span>
              <p>{message.content}</p>
            </div>
          ))
        )}
        {loading && (
          <div className="chat-message assistant thinking">
            <span>AssetTracker AI</span>
            <p>Reviewing your records…</p>
          </div>
        )}
        {error && (
          <div className="chat-error" role="alert">
            <AlertTriangle size={15} />
            <span>
              {error}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <textarea
          aria-label="Ask a question about your finances"
          maxLength={800}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Ask about your net worth…"
          ref={inputRef}
          rows={2}
          value={question}
        />
        <button
          aria-label="Send question"
          disabled={!question.trim() || loading || !aiEnabled}
          type="submit"
        >
          <Send size={17} />
        </button>
      </form>
      <p className="chat-privacy">
        AI is optional and read-only. History stays in this browser; the provider receives only anonymized totals and category aggregates—not names, notes, account numbers, or raw records.
      </p>
    </div>
  );
}

async function readFunctionError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "context" in error &&
    error.context instanceof Response
  ) {
    try {
      const body = (await error.context.clone().json()) as {
        error?: unknown;
      };
      if (typeof body.error === "string" && body.error.trim()) {
        return body.error;
      }
    } catch {
      // Fall back to the SDK message when the response is not JSON.
    }
  }
  return error instanceof Error
    ? error.message
    : "The assistant is temporarily unavailable.";
}

function formatRelativeTime(date: Date) {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} hr ago`;
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function loadStoredMessages(storageKey: string): AIChatMessage[] {
  try {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as AIChatMessage[]) : [];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}
