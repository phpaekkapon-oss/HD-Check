import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './fonts.css'
import './index.css'
import { App } from './App'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'

// Configure TanStack Query Client for HerbDx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Refresh status and report data when staff return to the tab after syncing.
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 minutes cache validity
    },
  },
})

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Fatal: root element #root not found in document DOM.')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
