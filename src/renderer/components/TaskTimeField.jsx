import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { normalizeTime24h } from '../utils/taskTime';

function partsFromValue(value) {
  const normalized = normalizeTime24h(value);
  if (!normalized) return { hour: '', minute: '' };
  const [hour, minute] = normalized.split(':');
  return { hour, minute };
}

const cellClass =
  'w-11 text-center rounded-lg border border-[#E5E5EA] dark:border-white/15 bg-white dark:bg-[#2C2C2E] text-[14px] tabular-nums outline-none focus:ring-2 focus:ring-light-accent/30 dark:focus:ring-dark-accent/30';

const TaskTimeField = forwardRef(function TaskTimeField(
  { label, value, onChange, id, syncToParent = false },
  ref
) {
  const [hour, setHour] = useState('');
  const [minute, setMinute] = useState('');
  const hourRef = useRef(null);
  const minuteRef = useRef(null);
  const groupRef = useRef(null);
  const focusedRef = useRef(false);

  const syncFromProp = useCallback((v) => {
    const p = partsFromValue(v);
    setHour(p.hour);
    setMinute(p.minute);
  }, []);

  useEffect(() => {
    if (focusedRef.current) return;
    syncFromProp(value);
  }, [value, syncFromProp]);

  const buildNormalized = useCallback((hVal, mVal, padDisplay) => {
    const hRaw = String(hVal ?? '').trim();
    const mRaw = String(mVal ?? '').trim();
    if (!hRaw && !mRaw) {
      onChange('');
      return '';
    }
    const h =
      hRaw === '' ? 0 : Math.min(23, Math.max(0, parseInt(hRaw, 10) || 0));
    const m =
      mRaw === '' ? 0 : Math.min(59, Math.max(0, parseInt(mRaw, 10) || 0));
    const padded = normalizeTime24h(`${h}:${m}`);
    if (padDisplay) {
      const [ph, pm] = padded.split(':');
      setHour(ph);
      setMinute(pm);
    }
    onChange(padded);
    return padded;
  }, [onChange]);

  const commit = useCallback(() => buildNormalized(hour, minute, true), [
    hour,
    minute,
    buildNormalized,
  ]);

  const syncLive = useCallback(
    (hVal, mVal) => {
      if (syncToParent) buildNormalized(hVal, mVal, false);
    },
    [syncToParent, buildNormalized]
  );

  useImperativeHandle(ref, () => ({ commit }), [commit]);

  const hourId = id ? `${id}-hour` : undefined;
  const minuteId = id ? `${id}-minute` : undefined;

  const onGroupFocusIn = () => {
    focusedRef.current = true;
  };

  const onGroupFocusOut = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    focusedRef.current = false;
    commit();
  };

  const blockEnter = (e, nextRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
      nextRef?.current?.focus();
    }
  };

  return (
    <div>
      {label ? (
        <label
          htmlFor={hourId}
          className="block text-xs text-light-dim dark:text-dark-dim mb-1"
        >
          {label}
        </label>
      ) : null}
      <div
        ref={groupRef}
        className="flex items-center gap-1 mt-1"
        role="group"
        aria-label={label || 'Vaqt (24 soat)'}
        onFocus={onGroupFocusIn}
        onFocusOut={onGroupFocusOut}
      >
        <input
          ref={hourRef}
          id={hourId}
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="00"
          value={hour}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 2);
            setHour(v);
            syncLive(v, minute);
          }}
          onKeyDown={(e) => blockEnter(e, minuteRef)}
          className={cellClass}
          aria-label="Soat (0-23)"
        />
        <span className="text-[14px] font-medium text-light-dim dark:text-dark-dim tabular-nums">
          :
        </span>
        <input
          ref={minuteRef}
          id={minuteId}
          type="text"
          inputMode="numeric"
          maxLength={2}
          placeholder="00"
          value={minute}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 2);
            setMinute(v);
            syncLive(hour, v);
          }}
          onKeyDown={(e) => blockEnter(e, null)}
          className={cellClass}
          aria-label="Daqiqa (0-59)"
        />
      </div>
    </div>
  );
});

export default TaskTimeField;
