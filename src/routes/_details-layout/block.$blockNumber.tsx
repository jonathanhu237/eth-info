import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_details-layout/block/$blockNumber')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_details-layout/block/$blockNumber"!</div>
}
