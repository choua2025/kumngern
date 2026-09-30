import { zodResolver } from '@hookform/resolvers/zod';
import {
  passwordSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@income-expenses/shared';
import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCurrencies } from '../../api/auth';
import { useChangePassword, useUpdateProfile } from '../../api/users';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Card, ErrorState, LoadingRows } from '../../components/states';
import { useToast } from '../../components/toast';
import { applyApiErrors } from '../../lib/form-errors';
import { currentTheme, setTheme, type Theme } from '../../lib/theme';
import { useAuth, useCurrentUser } from '../auth/auth-context';

const PREFERRED_TIMEZONES = [
  'Asia/Bangkok',
  'Asia/Vientiane',
  'Asia/Ho_Chi_Minh',
  'Asia/Singapore',
  'Asia/Tokyo',
  'UTC',
];

function timezoneOptions(current: string): string[] {
  const all = Intl.supportedValuesOf('timeZone');
  const rest = all.filter((tz) => !PREFERRED_TIMEZONES.includes(tz));
  return [...new Set([current, ...PREFERRED_TIMEZONES, ...rest])];
}

function ProfileForm() {
  const user = useCurrentUser();
  const { setUser } = useAuth();
  const currencies = useCurrencies();
  const updateProfile = useUpdateProfile();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      defaultCurrency: user.defaultCurrency,
      timezone: user.timezone,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const updated = await updateProfile.mutateAsync(values);
      setUser(updated);
      reset(values);
      toast.show('บันทึกโปรไฟล์แล้ว');
    } catch (error) {
      setFormError(applyApiErrors(error, setError, ['displayName', 'defaultCurrency', 'timezone']));
    }
  });

  if (currencies.isPending) return <LoadingRows rows={3} />;
  if (currencies.isError)
    return <ErrorState error={currencies.error} onRetry={() => void currencies.refetch()} />;

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
      {formError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {formError}
        </p>
      )}
      <InputField label="อีเมล" value={user.email} disabled readOnly />
      <InputField
        label="ชื่อที่แสดง"
        error={errors.displayName?.message}
        {...register('displayName')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="สกุลเงินหลัก"
          error={errors.defaultCurrency?.message}
          {...register('defaultCurrency')}
        >
          {currencies.data.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.symbol} {currency.code} — {currency.name}
            </option>
          ))}
        </SelectField>
        <SelectField label="Timezone" error={errors.timezone?.message} {...register('timezone')}>
          {timezoneOptions(user.timezone).map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </SelectField>
      </div>
      <p className="text-sm text-slate-500">
        สกุลเงินหลักใช้กับงบประมาณและรายงาน (นับเฉพาะกระเป๋าสกุลนี้) · timezone ใช้ตัดวันและเดือน
      </p>
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
        บันทึกโปรไฟล์
      </Button>
    </form>
  );
}

/** Client-only "confirm" field on top of the SAME new-password rules the API enforces. */
const passwordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'รหัสผ่านยืนยันไม่ตรงกัน',
    path: ['confirmPassword'],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม',
    path: ['newPassword'],
  });

type PasswordForm = z.input<typeof passwordFormSchema>;

function PasswordFormCard() {
  const changePassword = useChangePassword();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      reset();
      toast.show('เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นทั้งหมดถูกออกจากระบบ');
    } catch (error) {
      // A wrong current password is a 400 with details[0].path = "currentPassword".
      setFormError(applyApiErrors(error, setError, ['currentPassword', 'newPassword']));
    }
  });

  return (
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
        label="รหัสผ่านปัจจุบัน"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <InputField
        label="รหัสผ่านใหม่"
        type="password"
        autoComplete="new-password"
        hint="อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข"
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <InputField
        label="ยืนยันรหัสผ่านใหม่"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />
      <Button type="submit" loading={isSubmitting}>
        เปลี่ยนรหัสผ่าน
      </Button>
    </form>
  );
}

function ThemeSetting() {
  const [theme, setThemeState] = useState<Theme>(currentTheme);
  const choose = (value: Theme) => {
    setTheme(value);
    setThemeState(value);
  };
  return (
    <div
      role="radiogroup"
      aria-label="ธีม"
      className="inline-grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
    >
      {(
        [
          ['light', 'สว่าง', Sun],
          ['dark', 'มืด', Moon],
        ] as const
      ).map(([value, label, Icon]) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          onClick={() => choose(value)}
          className={`flex items-center justify-center gap-2 rounded-lg px-5 py-1.5 text-sm font-medium ${theme === value ? 'bg-white shadow-sm dark:bg-slate-950' : 'text-slate-600 dark:text-slate-400'}`}
        >
          <Icon className="size-4" aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">ตั้งค่า</h1>
      <Card title="โปรไฟล์">
        <ProfileForm />
      </Card>
      <Card title="เปลี่ยนรหัสผ่าน">
        <PasswordFormCard />
      </Card>
      <Card title="ธีม">
        <ThemeSetting />
      </Card>
    </div>
  );
}
