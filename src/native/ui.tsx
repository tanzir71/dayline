import { useEffect, useRef } from 'preact/hooks';
import { useApp } from '../app/context';
import { useLive, useNow } from '../app/live';
import { localDay } from '../lib/time';
import { applyReminders, handleReminderAction, planReminders, setupReminders, takePendingAction } from './reminders';
import { SpeakSheet } from './Speak';
import { ThisApp } from './ThisApp';
import '../styles/native.css';

/** Keeps the phone's dose reminders in step with the record, and answers notification buttons. */
function NativeRuntime() {
  const ctx = useApp();
  const latest = useRef(ctx);
  latest.current = ctx;
  const day = localDay(useNow(60_000));
  const wanted = useLive(() => planReminders(ctx), [day, ctx.lang], null);

  useEffect(() => {
    void setupReminders(latest.current);
    window.__daylineReminderAction = (action) => void handleReminderAction(latest.current, action);
    const pending = takePendingAction();
    if (pending) void handleReminderAction(latest.current, pending);
    return () => {
      window.__daylineReminderAction = undefined;
    };
  }, []);

  useEffect(() => {
    if (wanted) void applyReminders(wanted);
  }, [wanted]);

  return null;
}

export const ui = { NativeRuntime, SpeakSheet, ThisApp };
export type NativeUi = typeof ui;
