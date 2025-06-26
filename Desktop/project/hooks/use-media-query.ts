import { useEffect, useState } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Return early if we're on the server
    if (typeof window === 'undefined') return

    const media = window.matchMedia(query)
    
    // Set initial value
    setMatches(media.matches)

    // Create a handler
    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }

    // Add listener
    if (media.addEventListener) {
      media.addEventListener('change', handler)
    } else {
      // Fallback for older browsers
      media.addListener(handler)
    }

    // Cleanup function
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', handler)
      } else {
        // Fallback for older browsers
        media.removeListener(handler)
      }
    }
  }, [query])

  return matches
}