import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { SearchInput } from "@/feat/search/search-input"; // 导入搜索框组件
import { ModeToggle } from "@/components/mode-toggle";

export const Route = createFileRoute("/_details-layout")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-50 w-full border-b bg-background">
        {/* 内部 div 应用和 main 一样的宽度限制、居中和内边距 */}
        <div className="w-full max-w-7xl mx-auto px-4 flex h-14 items-center justify-between gap-4">
          {/* 左侧首页链接 */}
          <Link
            to="/"
            className="font-semibold text-lg hover:text-primary transition-colors"
          >
            EthInfo {/* 或者你可以用 Logo 组件/图标 */}
          </Link>

          {/* 右侧内容 - 添加 flex-grow 让其占据剩余空间 */}
          <div className="flex flex-grow items-center justify-end gap-4">
            {/* 搜索框，调整最大宽度 */}
            <div className="w-full max-w-md">
              <SearchInput />
            </div>

            {/* 主题切换按钮 */}
            <ModeToggle />
          </div>
        </div>
      </header>

      {/* 页面主要内容区域 */}
      {/* 手动实现居中、最大宽度和内边距 */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4">
        <Outlet /> {/* 子路由的内容将在这里渲染 */}
      </main>
    </div>
  );
}
