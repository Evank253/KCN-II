import { createFileRoute } from "@tanstack/react-router";
import { KcnConsole } from "@/components/kcn/console";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <KcnConsole />;
}
