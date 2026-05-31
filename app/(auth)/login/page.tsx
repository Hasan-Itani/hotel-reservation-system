import { redirect } from "next/navigation";
import { getSafeRedirectPath } from "@/lib/frontend/safe-redirect";

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const query = await searchParams;
  const next = getSafeRedirectPath(query?.next);

  redirect(`/guest/login?next=${encodeURIComponent(next)}`);
}