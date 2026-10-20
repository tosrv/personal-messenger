import { render, screen } from '@testing-library/react'
import { ConnectionBanner } from './ConnectionBanner'
import { StatusContext, type RealtimeStatus } from './status'

const renderWith = (status: RealtimeStatus) =>
  render(
    <StatusContext.Provider value={status}>
      <ConnectionBanner />
    </StatusContext.Provider>,
  )

describe('ConnectionBanner', () => {
  it.each(['online', 'idle'] as const)('is absent when %s', (status) => {
    renderWith(status)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('explains that messages are kept while offline', () => {
    renderWith('offline')
    expect(screen.getByRole('status')).toHaveTextContent(/Reconnecting/)
  })
})
