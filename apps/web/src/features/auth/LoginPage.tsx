import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Button } from '../../components/Button';
import { InputField } from '../../components/Field';
import { applyApiErrors } from '../../lib/form-errors';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from './auth-context';

export function LoginPage() {
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    // Same schema the API validates with (packages/shared).
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      // No navigate() here: RedirectIfAuthenticated reacts to the new auth state.
      await login(values);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['email', 'password']));
    }
  });

  return (
    <AuthLayout title="เข้าสู่ระบบ">
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
          >
            {formError}
          </p>
        )}
        <InputField
          label="อีเมล"
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label="รหัสผ่าน"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          เข้าสู่ระบบ
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        ยังไม่มีบัญชี?{' '}
        <Link
          to="/register"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          สมัครสมาชิก
        </Link>
      </p>
    </AuthLayout>
  );
}
