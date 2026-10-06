import { zodResolver } from '@hookform/resolvers/zod';
import {
  type ForgotPasswordInput,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@income-expenses/shared';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { requestPasswordReset, resetPassword } from '../../api/auth';
import { Button } from '../../components/Button';
import { InputField } from '../../components/Field';
import { applyApiErrors } from '../../lib/form-errors';
import { AuthLayout } from '../../layouts/AuthLayout';

/** Matches RESEND_COOLDOWN_SECONDS on the API (a quicker resend would be ignored there). */
const RESEND_SECONDS = 60;

const resetFormSchema = resetPasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'validation.passwordMismatch',
    path: ['confirmPassword'],
  });
type ResetForm = z.input<typeof resetFormSchema>;

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
    >
      {message}
    </p>
  );
}

/** Seconds left before "send again" is allowed; starts at `initial`. */
function useCountdown(seconds: number, initial: number): [number, () => void] {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, () => setLeft(seconds)];
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const { t } = useTranslation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await requestPasswordReset(values);
      onSent(values.email);
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['email']));
    }
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('forgot.intro')}</p>
      <FormError message={formError} />
      <InputField
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        autoFocus
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" loading={isSubmitting} className="w-full">
        {t('forgot.sendCode')}
      </Button>
    </form>
  );
}

function CodeStep({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The first code was just sent, so the countdown starts right away.
  const [resendIn, startCountdown] = useCountdown(RESEND_SECONDS, RESEND_SECONDS);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({
    resolver: zodResolver(resetFormSchema),
    defaultValues: { email, code: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ code, newPassword }) => {
    setFormError(null);
    try {
      await resetPassword({ email, code, newPassword });
      // Every session was revoked: sign in again with the new password.
      void navigate('/login', { replace: true, state: { notice: 'passwordReset' } });
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['code', 'newPassword']));
    }
  });

  const resend = async () => {
    setFormError(null);
    try {
      await requestPasswordReset({ email });
      setNotice(t('forgot.resent'));
      startCountdown();
    } catch (error) {
      setFormError(applyApiErrors(error, setError, []));
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('forgot.sentTo', { email })}</p>
      <FormError message={formError} />
      {notice && !formError && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {notice}
        </p>
      )}
      <InputField
        label={t('forgot.code')}
        inputMode="numeric"
        // Lets phones offer the code from the email/SMS keyboard suggestion.
        autoComplete="one-time-code"
        // No maxLength on purpose: a pasted "123 456" would be cut to "123 45" before the
        // non-digits are stripped. The shared schema checks for exactly 6 digits instead.
        autoFocus
        className="text-center text-2xl tracking-[0.5em]"
        error={errors.code?.message}
        {...register('code', { setValueAs: (v: string) => v.replace(/\D/g, '') })}
      />
      <InputField
        label={t('settings.newPassword')}
        type="password"
        autoComplete="new-password"
        hint={t('auth.passwordHint')}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <InputField
        label={t('settings.confirmPassword')}
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" loading={isSubmitting} className="w-full">
        {t('forgot.submit')}
      </Button>
      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={resendIn > 0}
          className="font-medium text-blue-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-blue-400"
        >
          {resendIn > 0 ? t('forgot.resendIn', { seconds: resendIn }) : t('forgot.resend')}
        </button>
        <button
          type="button"
          onClick={onChangeEmail}
          className="text-slate-600 hover:underline dark:text-slate-400"
        >
          {t('forgot.otherEmail')}
        </button>
      </div>
    </form>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState<string | null>(null);

  return (
    <AuthLayout title={t('forgot.title')}>
      {email === null ? (
        <EmailStep onSent={setEmail} />
      ) : (
        <CodeStep email={email} onChangeEmail={() => setEmail(null)} />
      )}
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          {t('forgot.backToLogin')}
        </Link>
      </p>
    </AuthLayout>
  );
}
