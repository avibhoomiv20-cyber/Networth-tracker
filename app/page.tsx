import { AuthPanel } from "@/components/auth/AuthPanel";
import { AppShell } from "@/components/shell/AppShell";
import { BrandMark } from "@/components/ui/BrandMark";
import { loadPersonalWorkspace } from "@/lib/portfolio/loadWorkspace";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  if (!isSupabaseConfigured) {
    return (
      <main className="configuration-screen">
        <BrandMark size="large" />
        <section className="configuration-card">
          <p className="eyebrow">Configuration needed</p>
          <h1>Connect your Supabase project</h1>
          <p>
            Add the public Supabase URL and publishable key to the deployment
            environment, then restart the application.
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthPanel />;
  }

  const result = await loadPersonalWorkspace(supabase);

  return (
    <AppShell
      userId={user.id}
      workspace={result.workspace}
      trackerData={result.trackerData}
      setupError={result.setupError}
      refreshedAt={new Date().toISOString()}
    />
  );
}
