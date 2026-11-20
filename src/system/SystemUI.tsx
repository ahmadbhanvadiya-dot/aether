import { RotateCw, X } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { useExperience } from '../state/useExperience'

/**
 * Phase 10: failure handling. Nothing should ever leave the visitor on a black
 * screen or a frozen count: WebGL that is missing or lost, code that failed to
 * load, a start that takes too long — each says what happened and offers the one
 * action that helps. Progress lives in localStorage, so reloading is always safe.
 */

/** Catches a render error below it; reports it as a fault and renders `fallback`. */
export class Boundary extends Component<{ children: ReactNode; fallback?: ReactNode; fault: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error(error)
    this.props.fault(error)
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}

export function FaultUI() {
  const fault = useExperience((s) => s.fault)
  const setFault = useExperience((s) => s.setFault)
  return (
    <div className="fault" data-open={fault ? true : undefined} role="alert" aria-live="assertive">
      {fault && (
        <div className="fault-panel" key={fault.id}>
          <p className="fault-title">{fault.title}</p>
          <p className="fault-detail">{fault.detail}</p>
          {(fault.reload || fault.dismissible) && (
            <div className="fault-actions">
              {fault.reload && (
                <button type="button" className="quiet-button px-3" onClick={() => window.location.reload()}>
                  <RotateCw size={14} strokeWidth={1.5} aria-hidden />
                  Reload
                </button>
              )}
              {fault.dismissible && (
                <button type="button" className="quiet-button px-3" onClick={() => setFault(null)}>
                  <X size={14} strokeWidth={1.5} aria-hidden />
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
