import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDemo } from "@/demo/store";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Admin belépés — TetőVonal" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const { ready, authenticated, backendAvailable, login } = useDemo();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && authenticated) void navigate({ to: "/admin", replace: true });
  }, [ready, authenticated, navigate]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const message = await login(email, password);
    if (message) {
      setError(message);
      setSubmitting(false);
      return;
    }
    await navigate({ to: "/admin", replace: true });
  };

  return (
    <main className="grid min-h-screen place-items-center bg-ink px-5 py-12 text-ink-foreground">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-white/10 bg-surface p-6 text-foreground shadow-lift sm:p-8">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">Admin belépés</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A kezelőfelület és az ügyféladatok csak hitelesített tulajdonosi fiókkal érhetők el.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">E-mail cím</Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Jelszó</Label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {!backendAvailable ? (
            <p className="text-xs text-muted-foreground">
              A szerverkapcsolat jelenleg nem érhető el.
            </p>
          ) : null}
          <Button type="submit" variant="copper" className="w-full" disabled={submitting}>
            {submitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            Belépés
          </Button>
        </form>

        <Button asChild variant="ghost" className="mt-3 w-full">
          <Link to="/">
            <ArrowLeft /> Vissza a weboldalra
          </Link>
        </Button>
      </div>
    </main>
  );
}
