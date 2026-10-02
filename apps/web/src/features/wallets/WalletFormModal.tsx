import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateWalletInput,
  createWalletSchema,
  WALLET_TYPES,
  type WalletDto,
} from '@income-expenses/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useCurrencies } from '../../api/auth';
import { useCreateWallet, useUpdateWallet } from '../../api/wallets';
import { Button } from '../../components/Button';
import { InputField, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/toast';
import { applyApiErrors } from '../../lib/form-errors';
import { useCurrentUser } from '../auth/auth-context';

function WalletForm({ wallet, onDone }: { wallet: WalletDto | null; onDone: () => void }) {
  const { t } = useTranslation();
  const user = useCurrentUser();
  const currencies = useCurrencies();
  const createWallet = useCreateWallet();
  const updateWallet = useUpdateWallet();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWalletInput>({
    resolver: zodResolver(createWalletSchema),
    defaultValues: {
      name: wallet?.name ?? '',
      type: wallet?.type ?? 'cash',
      currencyCode: wallet?.currencyCode ?? user.defaultCurrency,
      initialBalance: wallet?.initialBalance ?? '0',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      if (wallet) {
        // Currency and opening balance are fixed once the wallet exists (API rule).
        await updateWallet.mutateAsync({
          id: wallet.id,
          patch: { name: values.name, type: values.type },
        });
        toast.show(t('wallets.saved'));
      } else {
        await createWallet.mutateAsync(values);
        toast.show(t('wallets.created'));
      }
      onDone();
    } catch (error) {
      setFormError(
        applyApiErrors(error, setError, ['name', 'type', 'currencyCode', 'initialBalance']),
      );
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
        label={t('wallets.name')}
        autoFocus
        error={errors.name?.message}
        {...register('name')}
      />
      <SelectField label={t('common.type')} error={errors.type?.message} {...register('type')}>
        {WALLET_TYPES.map((type) => (
          <option key={type} value={type}>
            {t(`walletTypes.${type}`)}
          </option>
        ))}
      </SelectField>
      {!wallet && (
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t('wallets.currency')}
            error={errors.currencyCode?.message}
            {...register('currencyCode')}
          >
            {(currencies.data ?? []).map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.symbol} {currency.code}
              </option>
            ))}
          </SelectField>
          <InputField
            label={t('wallets.initialBalance')}
            inputMode="decimal"
            hint={t('wallets.initialBalanceHint')}
            error={errors.initialBalance?.message}
            {...register('initialBalance', { setValueAs: (v: string) => v.replace(/[,\s]/g, '') })}
          />
        </div>
      )}
      <Button type="submit" loading={isSubmitting} className="w-full">
        {wallet ? t('common.save') : t('wallets.create')}
      </Button>
    </form>
  );
}

export function WalletFormModal({
  open,
  wallet,
  onClose,
}: {
  open: boolean;
  wallet: WalletDto | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onClose} title={wallet ? t('wallets.editTitle') : t('wallets.add')}>
      <WalletForm wallet={wallet} onDone={onClose} />
    </Modal>
  );
}
