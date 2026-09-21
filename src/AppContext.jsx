import { createContext, useContext } from 'react'

// Shared state for the whole inventory screen: the loaded records, the active
// theme, and the handful of actions every tab needs. Screens read this instead
// of having the same dozen props threaded down through every level.
const AppContext = createContext(null)

export function AppProvider({ value, children }) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
