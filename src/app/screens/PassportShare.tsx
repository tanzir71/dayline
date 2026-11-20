import { useApp } from '../context';
import { useChildData } from '../data';
import { ShareSheetBase } from './ShareSheet';
import { buildPassport, PassportPage } from '../passport';
import { fmt } from '../../i18n';
import { go } from '../router';

/** Share the hospital passport: show it, a one-page PDF, or print. */
export function PassportShareSheet({ onClose }: { onClose: () => void }) {
  const ctx = useApp();
  const { t, child, lang } = ctx;
  const data = useChildData();
  const name = child!.name;
  return (
    <ShareSheetBase
      title={fmt(t.passport.share, { name })}
      subtitle={fmt(t.passport.shareSub, { name })}
      what="passport"
      fileWhat="hospital-passport"
      pdfTitle={(l) => fmt(buildPassport(ctx, data, l).t.passport.pdfTitle, { name })}
      pdfBody={t.passport.pdfBody}
      showBody={t.passport.showBody}
      show={(l) => go(`/passport/${l}`)}
      pages={(l) => <PassportPage p={buildPassport(ctx, data, l)} />}
      initialLang={child!.language ?? lang}
      onClose={onClose}
    />
  );
}
