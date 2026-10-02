import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useCurrencies } from '../../api/auth';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { applyApiErrors } from '../../lib/form-errors';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from './auth-context';

export function RegisterPage() {
  const { t } = useTranslation();
  const { register: registerAccount } = useAuth();
  const currencies = useCurrencies();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', displayName: '', defaultCurrency: 'THB' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      // No navigate() here: RedirectIfAuthenticated reacts to the new auth state.
      await registerAccount(values);
    } catch (error) {
      setFormError(
        applyApiErrors(error, setError, ['email', 'password', 'displayName', 'defaultCurrency']),
      );
    }
  });

  return (
    <AuthLayout title={t('auth.register')}>
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
          label={t('auth.displayName')}
          autoComplete="name"
          autoFocus
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <InputField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          hint={t('auth.passwordHint')}
          error={errors.password?.message}
          {...register('password')}
        />
        <SelectField
          label={t('auth.defaultCurrency')}
          error={errors.defaultCurrency?.message}
          {...register('defaultCurrency')}
        >
          {(currencies.data ?? [{ code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2 }]).map(
            (currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.code} — {currency.name}
              </option>
            ),
          )}
        </SelectField>
        <Button type="submit" loading={isSubmitting} className="w-full">
          {t('auth.createAccount')}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        {t('auth.haveAccount')}{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          {t('auth.login')}
        </Link>
      </p>
    </AuthLayout>
  );
}
