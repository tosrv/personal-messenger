import {
  Code,
  KeyRound,
  MessageCircle,
  Moon,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { googleLoginUrl, useMe } from '../auth/api'

export const REPO_URL = 'https://github.com/tosrv/personal-messenger'
// Read once when the page loads; render must not call Date.
const YEAR = new Date().getFullYear()

/**
 * A landing section in the same line style as the chats page: a header row
 * (title left, number right) above a rule, then the content.
 */
function Section({
  id,
  index,
  title,
  children,
}: {
  id: string
  index: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-14 border-b border-line">
      <div className="flex items-baseline justify-between border-b border-line px-6 py-4 md:px-10">
        <h2 id={`${id}-title`} className="text-xl font-semibold">
          {title}
        </h2>
        <span className="font-mono text-xs text-muted" aria-hidden>
          {index}
        </span>
      </div>
      {children}
    </section>
  )
}

/** Boxes separated by 1px lines (the gap shows the line colour behind them). */
function BoxGrid({ className, children }: { className: string; children: ReactNode }) {
  return <ul className={`grid gap-px bg-line ${className}`}>{children}</ul>
}

function Box({ children }: { children: ReactNode }) {
  return <li className="bg-bg p-6 md:p-8">{children}</li>
}

const features: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Zap,
    title: 'Real-time delivery',
    text: 'New messages appear instantly over a WebSocket, usually in a few milliseconds.',
  },
  {
    icon: KeyRound,
    title: 'Sign in with Google',
    text: 'No new password to remember. Your email is never shown to other people.',
  },
  {
    icon: Search,
    title: 'Find people by username',
    text: 'Search from the chat list and start a conversation in one click.',
  },
  {
    icon: RefreshCw,
    title: 'Survives bad connections',
    text: 'Reconnects on its own and catches up on anything you missed. Nothing is sent twice.',
  },
  {
    icon: Trash2,
    title: 'Delete for me',
    text: 'Clear a chat from your side only, like WhatsApp. The other person keeps theirs.',
  },
  {
    icon: Moon,
    title: 'Light and dark',
    text: 'Follows your device, or pick a theme in settings. Works on phone and desktop.',
  },
]

export function FeaturesSection() {
  return (
    <Section id="features" index="01" title="Features">
      <BoxGrid className="sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <Box key={title}>
            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-line">
              <Icon className="size-4 text-accent" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </Box>
        ))}
      </BoxGrid>
    </Section>
  )
}

const steps: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: UserRound,
    title: 'Sign in',
    text: 'Continue with Google. Your account is created on the first visit.',
  },
  {
    icon: Search,
    title: 'Find someone',
    text: 'Type a username in the search box above your chats.',
  },
  {
    icon: MessageCircle,
    title: 'Start chatting',
    text: 'Messages are saved, synced and delivered in real time.',
  },
]

export function HowItWorksSection() {
  return (
    <Section id="how" index="02" title="How it works">
      <BoxGrid className="md:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }, i) => (
          <Box key={title}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, '0')}</span>
              <span className="h-px flex-1 bg-line" aria-hidden />
              <Icon className="size-4 text-muted" strokeWidth={1.75} aria-hidden />
            </div>
            <h3 className="mt-4 font-medium">{title}</h3>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </Box>
        ))}
      </BoxGrid>
    </Section>
  )
}

const stack = [
  { name: 'Go', role: 'API server' },
  { name: 'PostgreSQL', role: 'Message storage' },
  { name: 'WebSocket', role: 'Live delivery' },
  { name: 'React', role: 'Web app' },
  { name: 'Docker', role: 'Deployment' },
]

export function StackSection() {
  return (
    <Section id="stack" index="03" title="Built with">
      <BoxGrid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {stack.map(({ name, role }) => (
          <li key={name} className="bg-bg px-6 py-5">
            <p className="font-medium">{name}</p>
            <p className="text-xs text-muted">{role}</p>
          </li>
        ))}
        {/* Fills the empty cell on the 2- and 3-column layouts so the grid stays boxed. */}
        <li aria-hidden className="bg-bg lg:hidden" />
      </BoxGrid>
    </Section>
  )
}

export function ClosingSection() {
  const signedIn = Boolean(useMe().data)

  return (
    <section aria-labelledby="closing-title">
      <div className="flex flex-col items-center px-6 py-16 text-center md:py-20">
        <h2 id="closing-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Have something to say?
        </h2>
        <p className="mt-2 max-w-md text-muted">
          Sign in and send a message. It takes less than a minute.
        </p>
        <div className="mt-6">
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
              Get started
            </a>
          )}
        </div>
      </div>

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-line px-6 py-4 text-xs text-muted sm:flex-row md:px-10">
        <p>© {YEAR} Rahmat Tomy · Personal Messenger</p>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-fg"
        >
          <Code className="size-3.5" aria-hidden />
          Source on GitHub
        </a>
      </footer>
    </section>
  )
}
