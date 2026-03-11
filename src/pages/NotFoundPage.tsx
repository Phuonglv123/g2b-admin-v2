import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

const NotFoundPage = () => {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold">Không tìm thấy trang</h1>
      <p className="text-muted-foreground">
        Liên kết bạn truy cập không tồn tại hoặc đã bị di chuyển.
      </p>
      <Button asChild>
        <Link to="/">Quay lại trang chủ</Link>
      </Button>
    </div>
  )
}

export default NotFoundPage
