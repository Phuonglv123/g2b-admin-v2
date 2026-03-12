import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

const NotFoundPage = () => {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold">Page Not Found</h1>
      <p className="text-muted-foreground">
        The link you followed doesn't exist or has been moved.
      </p>
      <Button asChild>
        <Link to="/">Back to Home</Link>
      </Button>
    </div>
  )
}

export default NotFoundPage
