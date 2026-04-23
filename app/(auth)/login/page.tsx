import { LoginForm } from "@/components/shared/login-form";

export const metadata = { title: "Sign in — PM Dashboard" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <LoginForm />
    </main>
  );
}
