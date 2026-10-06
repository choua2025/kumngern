import { zodResolver } from '@hookform/resolvers/zod';
import { type LoginInput, loginSchema } from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { Button } from '../../components/Button';
import { InputField } from '../../components/Field';
import { applyApiErrors } from '../../lib/form-errors';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from './auth-context';

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const location = useLocation();
  const passwordReset = (location.state as { notice?: string } | null)?.notice === 'passwordReset';
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
    <AuthLayout title={t('auth.login')}>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
        {passwordReset && !formError && (
          <p
            role="status"
            className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            {t('forgot.done')}
          </p>
        )}
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
          >
            {formError}
          </p>
        )}
        <InputField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          autoFocus
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="-mt-2 text-right">
          <Link
            to="/forgot-password"
            className="text-sm text-blue-600 hover:underline dark:text-blue-400"
          >
            {t('forgot.link')}
          </Link>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full">
          {t('auth.login')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        {t('auth.noAccount')}{' '}
        <Link
          to="/register"
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {t('auth.register')}
        </Link>
      </p>
    </AuthLayout>
  );
}
