import { redirect } from "next/navigation";
import { getOptionalRedirectPath } from "@/lib/frontend/safe-redirect";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const next = getOptionalRedirectPath(query?.next);

  redirect(next ? `/guest/login?next=${encodeURIComponent(next)}` : "/guest/login");
}
