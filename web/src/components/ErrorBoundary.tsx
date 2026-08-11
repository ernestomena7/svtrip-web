// Containment for render-time errors.
//
// WHY THIS EXISTS: an uncaught error thrown during render unmounts the WHOLE
// React tree, so the page goes blank. That is not a hypothetical — it shipped.
// ConversationHistory formatted a Firestore Timestamp that its type claimed was
// a number, `Intl.DateTimeFormat` threw `RangeError: Invalid time value`, and
// the entire /guide screen rendered as an empty white page. The actual defect
// was a missing date on one row in a side panel.
//
// A boundary does not fix bugs; it bounds their blast radius. The failure above
// should have cost the history rail and nothing else.
//
// Deliberately NOT a global boundary at the root only: wrapping the whole app
// in one turns "a panel failed" into "the app failed", which is the same blank
// page with nicer wording. These are placed around the independently useful
// regions of a screen, so a broken one leaves its neighbours usable.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, ErrorState } from './ui';

interface Props {
  children: ReactNode;
  /**
   * Rendered instead of the children when they throw. Omit to get the standard
   * ErrorState — pass `null` for a region whose absence is better than a notice
   * (a decorative rail, an optional enhancement).
   */
  fallback?: ReactNode;
  /** Identifies the region in the console, since the UI deliberately does not. */
  label?: string;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is the only sink: there is no error-reporting service wired
    // up, and inventing one here would be a silent new dependency. Logged with
    // the component stack because the message alone ("Invalid time value") does
    // not say which region died — the exact problem that made the blank /guide
    // page take a browser session to trace.
    console.error(
      `[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`,
      error,
      info.componentStack,
    );
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return this.props.fallback ?? null;
  }
}

/**
 * The standard fallback: says this section failed, says the rest still works,
 * and offers a reload.
 *
 * A separate function component because a class cannot call `useTranslation`,
 * and the message must be localized like everything else — a boundary that
 * renders untranslated English is a worse failure than the one it caught.
 *
 * Reload rather than a retry button: the boundary cannot know whether the cause
 * was transient, and re-rendering the same subtree with the same state simply
 * throws again, which looks like a button that does nothing.
 */
export function CrashNotice() {
  const { t } = useTranslation();
  return (
    <Card className="p-5">
      <ErrorState
        message={t('web.crash.title')}
        action={
          <>
            <p className="max-w-sm text-sm text-muted">{t('web.crash.body')}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t('web.crash.action')}
            </Button>
          </>
        }
      />
    </Card>
  );
}
