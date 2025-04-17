import { createFileRoute } from "@tanstack/react-router";
import { SearchInput } from "@/feat/search/search-input";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="relative w-full max-w-xl px-4">
        <h1 className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 text-3xl font-bold whitespace-nowrap">
          ETH 信息查询
        </h1>
        <SearchInput />
      </div>
    </div>
  );
}
