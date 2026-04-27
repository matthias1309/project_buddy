import { LoginForm } from "@/components/shared/login-form";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export const metadata = { title: "Sign in — PM Dashboard" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <LoginForm />
    </main>
  );
}
