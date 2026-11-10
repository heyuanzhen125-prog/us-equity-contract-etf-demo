import { useEffect, useRef } from 'react'
import type { DependencyList } from 'react'

export function useVisiblePolling(
  callback: (signal: AbortSignal) => Promise<void>,
  intervalMs: number,
  enabled = true,
  dependencies: DependencyList = [],
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    let active = true
    let running = false
    let timer: number | undefined
    let controller: AbortController | undefined

    const schedule = () => {
      if (active && document.visibilityState === 'visible') {
        timer = window.setTimeout(() => void poll(), intervalMs)
      }
    }

    const poll = async () => {
      if (!active || running || document.visibilityState !== 'visible') return
      running = true
      controller = new AbortController()
      try {
        await callbackRef.current(controller.signal)
      } finally {
        controller = undefined
        running = false
        schedule()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timer !== undefined) window.clearTimeout(timer)
        timer = undefined
      } else {
        void poll()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void poll()
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (timer !== undefined) window.clearTimeout(timer)
      controller?.abort()
    }
  }, [enabled, intervalMs, ...dependencies])
}
