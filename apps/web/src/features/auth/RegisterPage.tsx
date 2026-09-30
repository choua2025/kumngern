import { zodResolver } from '@hookform/resolvers/zod';
import { type RegisterInput, registerSchema } from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrencies } from '../../api/auth';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { applyApiErrors } from '../../lib/form-errors';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from './auth-context';

export function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const navigate = useNavigate();
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
      await registerAccount(values);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(
        applyApiErrors(error, setError, ['email', 'password', 'displayName', 'defaultCurrency']),
      );
    }
  });

  return (
    <AuthLayout title="สมัครสมาชิก">
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
          label="ชื่อที่แสดง"
          autoComplete="name"
          autoFocus
          error={errors.displayName?.message}
          {...register('displayName')}
        />
        <InputField
          label="อีเมล"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label="รหัสผ่าน"
          type="password"
          autoComplete="new-password"
          hint="อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข"
          error={errors.password?.message}
          {...register('password')}
        />
        <SelectField
          label="สกุลเงินหลัก"
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
          สร้างบัญชี
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
        มีบัญชีแล้ว?{' '}
        <Link to="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
          เข้าสู่ระบบ
        </Link>
      </p>
    </AuthLayout>
  );
}
