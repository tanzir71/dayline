import { useApp } from '../context';
import { NavBar } from '../ui';

/** Insights arrive in M2; until then the tab says so plainly. */
export function Insights() {
  const { t } = useApp();
  return (
    <div class="app-screen with-nav">
      <main id="main" class="column app-main stack" style="--stack-gap: 12px">
        <h1 class="screen-title">{t.insights.title}</h1>
        <section class="card stack" style="--stack-gap: 8px">
          <p class="t-body-15">{t.insights.soon}</p>
          <p class="t-body-14 muted">{t.insights.meanwhile}</p>
        </section>
      </main>
      <NavBar active="insights" />
    </div>
  );
}
