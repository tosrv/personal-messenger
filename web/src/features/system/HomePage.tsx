import { Code, KeyRound, MessageCircle, SendHorizontal, Server, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { googleLoginUrl, useMe } from '../auth/api'
import { LandingNav } from './LandingNav'
import {
  ClosingSection,
  FeaturesSection,
  HowItWorksSection,
  REPO_URL,
  StackSection,
} from './LandingSections'

const highlights = [
  { icon: Zap, label: 'Real-time', text: 'Messages arrive instantly over WebSocket.' },
  { icon: KeyRound, label: 'No new password', text: 'Sign in with your Google account.' },
  { icon: Server, label: 'Self-hosted', text: 'Runs on its own server, data in PostgreSQL.' },
]

/**
 * Landing page, drawn in the same line style as the chats page: one column
 * framed by vertical rules, sections separated by horizontal rules.
 */
export function HomePage() {
  return (
    <>
      {/* Sticky inside the same scroll area as the page, so the navbar's side
          rules always line up with the page's (the scrollbar takes width from both). */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <LandingNav />
      </header>
      <div className="mx-auto max-w-7xl border-line md:border-x">
        {/* Home: fills most of the first screen, content centred vertically. */}
        <div
          id="home"
          className="relative isolate flex min-h-[80dvh] items-center overflow-hidden border-b border-line"
        >
          <GridLines />
          <HomeSection />
        </div>
        <FeaturesSection />
        <HowItWorksSection />
        <StackSection />
        <ClosingSection />
      </div>
    </>
  )
}

function HomeSection() {
  const me = useMe()
  const signedIn = Boolean(me.data)

  return (
    <section
      aria-labelledby="home-title"
      className="grid w-full items-center gap-12 px-6 py-14 md:grid-cols-2 md:px-10 md:py-20"
    >
      {/* Centred when stacked on phones, left-aligned beside the preview on wide screens. */}
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <h1
          id="home-title"
          className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl"
        >
          A messenger
          <br />
          you actually own.
        </h1>
        <p className="mt-4 max-w-md text-muted">
          Personal Messenger is a small, fast chat app built and run by its owner. Find someone by
          username and start a conversation in seconds.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
          {signedIn ? (
            <Link
              to="/chats"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <MessageCircle className="size-4" aria-hidden />
              Open chats
            </Link>
          ) : (
            <a
              href={googleLoginUrl('/chats')}
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-medium text-accent-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <MessageCircle className="size-4" aria-hidden />
              Continue with Google
            </a>
          )}
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-5 py-2.5 font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <Code className="size-4" aria-hidden />
            View source
          </a>
        </div>
        {!signedIn && (
          <Link to="/login" className="mt-4 text-sm text-muted hover:text-fg hover:underline">
            No Google account? Chat as a guest →
          </Link>
        )}

        <ul className="mt-10 text-left">
          {highlights.map(({ icon: Icon, label, text }) => (
            <li key={label} className="flex items-start gap-3 py-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              <p className="text-sm">
                <span className="font-medium">{label}.</span>{' '}
                <span className="text-muted">{text}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      <ChatPreview />
    </section>
  )
}

/** A static, line-drawn chat window that shows what the app looks like. */
function ChatPreview() {
  return (
    <figure aria-hidden className="relative mx-auto w-full max-w-sm md:max-w-none">
      <div className="rounded-2xl border border-line bg-bg shadow-sm">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent">
            T
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium">Tomy</p>
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className="size-1.5 rounded-full bg-ok" /> online
            </p>
          </div>
        </div>

        <div className="space-y-2 px-4 py-5">
          <div className="flex justify-center">
            <span className="rounded-full border border-line px-3 py-0.5 text-xs text-muted">
              Today
            </span>
          </div>
          <Bubble>Hi! I saw your portfolio 👋</Bubble>
          <Bubble mine>Hey, thanks for reaching out!</Bubble>
          <Bubble>Do you have time to talk about a project?</Bubble>
          <Bubble mine>Sure, tell me more.</Bubble>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <span className="flex-1 text-sm text-muted">Write a message</span>
          <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-fg">
            <SendHorizontal className="size-4" />
          </span>
        </div>
      </div>
    </figure>
  )
}

function Bubble({ mine, children }: { mine?: boolean; children: string }) {
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <p
        className={`max-w-[80%] rounded-2xl px-3 py-1 text-sm ${
          mine ? 'bg-accent text-accent-fg' : 'border border-line bg-surface'
        }`}
      >
        {children}
      </p>
    </div>
  )
}

/** Faint line grid behind the hero, fading out toward the edges. */
function GridLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--color-line)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] bg-[size:48px_48px]"
    />
  )
}
