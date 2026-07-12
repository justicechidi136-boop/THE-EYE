import { Suspense } from "react";
import { AuthLayout } from "../../components/auth-layout";
import { LoginForm } from "../../components/login-form";

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<p className="text-sm text-muted">Loading sign in...</p>}>
        <LoginForm />
      </Suspense>
    </AuthLayout>
  );
}
