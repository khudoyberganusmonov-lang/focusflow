import { useEffect, useState, useCallback, useRef } from 'react';
import TitleBar from './components/TitleBar';
import Sidebar from './components/Sidebar';
import MenuBar from './components/MenuBar';
import FocusTimer from './components/FocusTimer';
import FocusFullscreenLock from './components/FocusFullscreenLock';
import FocusStopLockModal from './components/FocusStopLockModal';
import FocusSummaryModal from './components/FocusSummaryModal';
import FocusCoachCard from './components/FocusCoachCard';
import FocusRestoredBanner from './components/FocusRestoredBanner';
import Today from './pages/Today';
import Tasks from './pages/Tasks';
import TimeTracker from './pages/TimeTracker';
import Blocker from './pages/Blocker';
import AI from './pages/AI';
import SettingsPage from './pages/Settings';
import { useSettings } from './context/SettingsContext';

export default function App() {
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState('today');
  const [focusState, setFocusState] = useState(null);
  const [focusSummary, setFocusSummary] = useState(null);
  const [showStopLock, setShowStopLock] = useState(false);
  const [quitPending, setQuitPending] = useState(false);
  const quitPendingRef = useRef(false);
  const [dailyGreeting, setDailyGreeting] = useState(null);
  const [coachMessage, setCoachMessage] = useState(null);
  const [showRestoredBanner, setShowRestoredBanner] = useState(false);

  useEffect(() => {
    if (!window.focusflow?.ai?.getDailyGreeting) return;
    if (!settings?.hasAnthropicApiKey) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await window.focusflow.ai.getDailyGreeting();
        if (!cancelled && res?.show && res.content) {
          setDailyGreeting({ type: res.type, content: res.content });
        }
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settings?.hasAnthropicApiKey]);

  useEffect(() => {
    if (!window.focusflow) return;
    window.focusflow.focus.getState().then((state) => {
      setFocusState(state);
      if (state?.restored) setShowRestoredBanner(true);
    });
    const unsub = window.focusflow.focus.onStateChange((state) => {
      setFocusState(state);
      if (state?.restored) setShowRestoredBanner(true);
    });
    const unsubSummary = window.focusflow.focus.onSummary((s) => {
      if (quitPendingRef.current) return;
      setFocusSummary(s);
      setFocusState(null);
      setShowStopLock(false);
      setQuitPending(false);
    });
    const unsubRequestStop = window.focusflow.focus.onRequestStop(async () => {
      const prev = await window.focusflow.focus.getState();
      if (prev?.fullscreenLock && prev.remainingSeconds > 0) return;
      setShowStopLock(true);
    });
    const unsubQuitAfterLock = window.focusflow.app.onQuitAfterLock(() => {
      quitPendingRef.current = true;
      setQuitPending(true);
      setShowStopLock(true);
    });
    const unsubCoach = window.focusflow.ai.onFocusCoach((payload) => {
      setCoachMessage(payload);
    });
    return () => {
      unsub();
      unsubSummary();
      unsubRequestStop();
      unsubQuitAfterLock();
      unsubCoach?.();
    };
  }, []);

  useEffect(() => {
    if (!focusState) setCoachMessage(null);
  }, [focusState]);

  const handleStartFocus = useCallback(
    async ({ projectId, taskId }) => {
      const state = await window.focusflow.focus.start({
        projectId,
        taskId: taskId || null,
        durationMinutes: settings?.focusDuration,
      });
      setFocusState(state);
    },
    [settings?.focusDuration]
  );

  const handlePause = async () => {
    setFocusState(await window.focusflow.focus.pause());
  };

  const handleResume = async () => {
    setFocusState(await window.focusflow.focus.resume());
  };

  const handleStopRequest = () => {
    if (focusState?.fullscreenLock && focusState.remainingSeconds > 0) return;
    setShowStopLock(true);
  };

  const handleConfirmStop = async () => {
    const shouldQuit = quitPending || quitPendingRef.current;
    const result = await window.focusflow.focus.stop();
    setShowStopLock(false);
    setQuitPending(false);
    quitPendingRef.current = false;
    if (shouldQuit) {
      await window.focusflow.app.quit();
      return;
    }
    if (result?.summary) setFocusSummary(result.summary);
    else setFocusState(null);
  };

  const handleStopLockCancel = async () => {
    setShowStopLock(false);
    if (quitPending || quitPendingRef.current) {
      setQuitPending(false);
      quitPendingRef.current = false;
      await window.focusflow.app.cancelQuit();
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'today':
        return (
          <Today
            onStartFocus={handleStartFocus}
            focusState={focusState}
            dailyGreeting={dailyGreeting}
            onDismissDailyGreeting={() => setDailyGreeting(null)}
          />
        );
      case 'tasks':
        return (
          <Tasks onStartFocus={handleStartFocus} focusState={focusState} />
        );
      case 'ai':
        return (
          <AI
            focusState={focusState}
            onOpenSettings={() => setActiveTab('settings')}
          />
        );
      case 'time':
        return <TimeTracker />;
      case 'blocker':
        return <Blocker />;
      case 'settings':
        return <SettingsPage />;
      default:
        return null;
    }
  };

  return (
    <div className="app-shell flex flex-col h-screen overflow-hidden bg-white dark:bg-[#1C1C1E]">
      <TitleBar />
      <MenuBar focusState={focusState} onStopRequest={handleStopRequest} />
      {showRestoredBanner && focusState && (
        <FocusRestoredBanner onDismiss={() => setShowRestoredBanner(false)} />
      )}
      <main className="flex-1 overflow-hidden relative min-h-0 flex flex-col pt-12">
        {focusState && coachMessage && (
          <FocusCoachCard
            coach={coachMessage}
            onDismiss={() => setCoachMessage(null)}
          />
        )}
        <div className="flex-1 overflow-hidden min-h-0">{renderPage()}</div>
      </main>
      <aside className="shrink-0 sidebar-blur bg-light-sidebar/90 dark:bg-dark-sidebar/90 border-t border-black/5 dark:border-white/10">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </aside>

      {focusState &&
        ((focusState.fullscreenLock ||
          (focusState.pomodoro?.enabled && focusState.pomodoro?.phase === 'break')) &&
        focusState.remainingSeconds > 0 ? (
          <FocusFullscreenLock focusState={focusState} />
        ) : (
          <FocusTimer
            focusState={focusState}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStopRequest}
          />
        ))}

      {focusState && showStopLock && (
        <FocusStopLockModal
          focusState={focusState}
          quitPending={quitPending}
          onCancel={handleStopLockCancel}
          onConfirmStop={handleConfirmStop}
        />
      )}

      {focusSummary && (
        <FocusSummaryModal
          summary={focusSummary}
          onClose={() => setFocusSummary(null)}
        />
      )}
    </div>
  );
}
