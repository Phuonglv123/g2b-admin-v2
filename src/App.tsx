import AppRouter from "@/routes/AppRouter"
import ErrorBoundary from "@/components/ErrorBoundary"

const App = () => {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  )
}

export default App
