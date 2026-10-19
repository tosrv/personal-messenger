import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

/** Last-resort boundary so a render crash shows a message instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 rounded-lg border border-line px-3 py-1.5 hover:bg-surface"
        >
          Reload
        </button>
      </div>
    )
  }
}
