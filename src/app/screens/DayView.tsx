import { useApp } from '../context';
import { useChildData, useEvents } from '../data';
import { ScreenHeader, TimelineItem } from '../ui';
import { describeEvent, KIND_TONE, dateLabel, wallTime } from '../format';

/** One past day on the day line, read-only (patterns open their raw days here). */
export function DayView({ day }: { day: string }) {
  const ctx = useApp();
  const { t, lang } = ctx;
  const data = useChildData();
  const { events, tags } = useEvents(day, day);
  return (
    <div class="app-screen">
      <main id="main" class="column app-main stack" style="--stack-gap: 12px">
        <ScreenHeader title={dateLabel(new Date(`${day}T12:00:00`), lang)} backTo="/insights" />
        <section class="card">
          {events.length ? (
            <ol class="timeline" role="list">
              {events.map((e) => {
                const d = describeEvent(e, tags.filter((x) => x.event_id === e.id), data.medicines, ctx);
                return <TimelineItem key={e.id} time={wallTime(e.started_at, lang)} tone={KIND_TONE[e.kind] ?? 'neutral'} title={d.title} detail={d.detail} />;
              })}
            </ol>
          ) : (
            <p class="t-body-14 muted">{t.today.empty}</p>
          )}
        </section>
      </main>
    </div>
  );
}
