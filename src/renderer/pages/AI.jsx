import { useEffect, useState, useRef, useCallback } from 'react';
import { useSettings } from '../context/SettingsContext';

const PLAN_STORAGE_KEY = 'focusflow_plan_date';
const AI_ERROR = 'AI vaqtincha ishlamayapti';
const NO_API_KEY_MSG =
  "API key kiritilmagan. Sozlamalar bo'limiga o'ting va Anthropic API keyingizni kiriting.";

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

export default function AI({ focusState, onOpenSettings }) {
  const { settings } = useSettings();
  const hasApiKey = Boolean(settings?.hasAnthropicApiKey);
  const dayPlanEnabled = settings?.aiFeatures?.dayPlan !== false;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dayPlan, setDayPlan] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const bottomRef = useRef(null);
  const streamRef = useRef('');

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const runPlanDay = useCallback(
    async (silent = false) => {
      if (!hasApiKey || !dayPlanEnabled || !window.focusflow?.ai?.planDay) return;
      setPlanLoading(true);
      const res = await window.focusflow.ai.planDay();
      setPlanLoading(false);
      if (res.error) {
        if (!silent) setDayPlan(res.plan || res.message || AI_ERROR);
      } else {
        setDayPlan(res.plan || '');
        localStorage.setItem(PLAN_STORAGE_KEY, todayKey());
      }
    },
    [hasApiKey, dayPlanEnabled]
  );

  const send = async (text) => {
    if (!text.trim() || loading) return;
    if (!hasApiKey) return;

    const userMsg = { role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    streamRef.current = '';

    const assistantIdx = next.length;
    setMessages([...next, { role: 'assistant', content: '' }]);

    const unsubChunk = window.focusflow.ai.onChatChunk((chunk) => {
      if (chunk.type === 'delta') {
        streamRef.current += chunk.text;
        setMessages((prev) => {
          const copy = [...prev];
          if (copy[assistantIdx]) {
            copy[assistantIdx] = {
              role: 'assistant',
              content: streamRef.current,
            };
          }
          return copy;
        });
      }
      if (chunk.type === 'error') {
        streamRef.current = chunk.text || AI_ERROR;
      }
    });

    const response = await window.focusflow.ai.chat(
      next.filter((m) => m.role === 'user' || m.role === 'assistant'),
      { stream: true }
    );

    unsubChunk?.();
    setLoading(false);

    if (!response) {
      setMessages((prev) => {
        const copy = [...prev];
        if (copy[assistantIdx]) {
          copy[assistantIdx] = { role: 'assistant', content: NO_API_KEY_MSG };
        }
        return copy;
      });
      return;
    }

    const finalText = response.error
      ? response.content || AI_ERROR
      : response.content || streamRef.current || AI_ERROR;

    setMessages((prev) => {
      const copy = [...prev];
      if (copy[assistantIdx]) {
        copy[assistantIdx] = { role: 'assistant', content: finalText };
      }
      return copy;
    });
  };

  const quickAction = (action) => {
    if (!hasApiKey) return;
    if (action === 'suggest') {
      send('Bugungi loyihalarim uchun 3 ta aniq vazifa tavsiya qil.');
    } else if (action === 'analyze') {
      send('Haftalik mahsuldorligimni tahlil qil va tavsiyalar ber.');
    } else if (action === 'focus') {
      send('Fokus sessiyasi uchun qisqa maslahat ber.');
    }
  };

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-light-dim">
        …
      </div>
    );
  }

  if (!hasApiKey) {
    return (
      <div className="flex flex-col h-full">
        <header className="px-5 pt-12 pb-3 shrink-0">
          <h1 className="text-2xl font-semibold">AI</h1>
          <p className="text-sm text-light-dim dark:text-dark-dim">
            FocusFlow yordamchisi
          </p>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="max-w-sm text-sm leading-relaxed text-light-dim dark:text-dark-dim">
            {NO_API_KEY_MSG}
          </p>
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-5 rounded-xl bg-light-accent px-5 py-2.5 text-sm font-medium text-white dark:bg-dark-accent"
            >
              Sozlamalarga o&apos;tish
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-5 pt-12 pb-3 shrink-0">
        <h1 className="text-2xl font-semibold">AI</h1>
        <p className="text-sm text-light-dim dark:text-dark-dim">
          FocusFlow yordamchisi
        </p>
      </header>

      {dayPlanEnabled && (
      <div className="px-4 pb-3 shrink-0 space-y-3">
        <div className="p-4 rounded-2xl bg-light-accent/10 dark:bg-dark-accent/15">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Bugungi reja</h2>
            <button
              type="button"
              disabled={planLoading}
              onClick={() => runPlanDay(false)}
              className="text-xs px-3 py-1 rounded-lg bg-light-accent dark:bg-dark-accent text-white disabled:opacity-50"
            >
              {planLoading ? 'Tuzilmoqda...' : 'Reja tuzish'}
            </button>
          </div>
          {planLoading && !dayPlan ? (
            <p className="text-xs text-light-dim animate-pulse">AI reja tuzmoqda...</p>
          ) : dayPlan ? (
            <pre className="text-xs whitespace-pre-wrap leading-relaxed text-light-dim dark:text-dark-dim font-sans">
              {dayPlan}
            </pre>
          ) : (
            <p className="text-xs text-light-dim">
              Kun rejasini tuzish uchun &quot;Reja tuzish&quot; tugmasini bosing.
            </p>
          )}
        </div>

      </div>
      )}

      <div className="flex gap-2 px-4 pb-2 shrink-0 flex-wrap">
        {[
          { id: 'suggest', label: 'Vazifa tavsiya qil' },
          { id: 'analyze', label: 'Haftani tahlil qil' },
          { id: 'focus', label: 'Fokus maslahat' },
        ].map((chip) => (
          <button
            key={chip.id}
            type="button"
            disabled={loading}
            onClick={() => quickAction(chip.id)}
            className="text-xs px-3 py-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 disabled:opacity-40 transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="text-center text-light-dim dark:text-dark-dim text-sm mt-4 px-4">
            Salom! Bugungi rejangizni muhokama qilaylik yoki tezkor tugmalardan foydalaning.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-light-accent dark:bg-dark-accent text-white rounded-br-md'
                  : 'bg-black/5 dark:bg-white/10 rounded-bl-md'
              }`}
            >
              {msg.content || (loading && i === messages.length - 1 ? '...' : '')}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5 rounded-2xl bg-black/5 dark:bg-white/10 text-sm text-light-dim flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
              </span>
              Yozmoqda...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="no-drag p-4 border-t border-black/5 dark:border-white/10 flex gap-2 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Xabar yozing..."
          className="flex-1 px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/10 text-sm outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition-all duration-200"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 rounded-xl bg-light-accent dark:bg-dark-accent text-white text-sm font-medium disabled:opacity-40 transition-all duration-200"
        >
          Yuborish
        </button>
      </form>
    </div>
  );
}
