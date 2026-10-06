import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authHttp } from '../../api/client';
import { ForgotPasswordPage } from './ForgotPasswordPage';

let calls: { url: string; body: unknown }[] = [];

beforeEach(() => {
  calls = [];
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    calls.push({ url: config.url ?? '', body: JSON.parse(String(config.data)) as unknown });
    const status = config.url === '/auth/forgot-password' ? 202 : 204;
    return Promise.resolve({
      status,
      statusText: '',
      headers: {},
      config,
      data: '',
    } as AxiosResponse);
  };
  authHttp.defaults.adapter = adapter;
});

const originalAdapter = authHttp.defaults.adapter;
afterEach(() => {
  authHttp.defaults.adapter = originalAdapter;
});

function LoginStub() {
  const location = useLocation();
  return <p>login page, notice={(location.state as { notice?: string } | null)?.notice}</p>;
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/login" element={<LoginStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<ForgotPasswordPage>', () => {
  it('asks for the email, then the code + new password, then returns to login', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('อีเมล'), 'Ann@Example.com');
    await user.click(screen.getByRole('button', { name: 'ส่งรหัส' }));

    // Step 2: the message never says whether the address has an account.
    expect(await screen.findByText(/ถ้า ann@example.com มีบัญชีอยู่/)).toBeInTheDocument();
    expect(calls[0]).toEqual({ url: '/auth/forgot-password', body: { email: 'ann@example.com' } });
    // The first code was just sent: "send again" waits for the cooldown.
    expect(screen.getByRole('button', { name: /ส่งรหัสใหม่ได้ใน 60 วินาที/ })).toBeDisabled();

    await user.type(screen.getByLabelText('รหัสจากอีเมล'), '12-34 56'); // pasted with junk
    await user.type(screen.getByLabelText('รหัสผ่านใหม่'), 'BrandNew123!');
    await user.type(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), 'BrandNew123!');
    await user.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

    await waitFor(() =>
      expect(screen.getByText('login page, notice=passwordReset')).toBeInTheDocument(),
    );
    expect(calls[1]).toEqual({
      url: '/auth/reset-password',
      body: { email: 'ann@example.com', code: '123456', newPassword: 'BrandNew123!' },
    });
  });

  it('checks the confirmation and the code format before calling the API', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('อีเมล'), 'ann@example.com');
    await user.click(screen.getByRole('button', { name: 'ส่งรหัส' }));
    await screen.findByLabelText('รหัสจากอีเมล');

    await user.type(screen.getByLabelText('รหัสจากอีเมล'), '123');
    await user.type(screen.getByLabelText('รหัสผ่านใหม่'), 'BrandNew123!');
    await user.type(screen.getByLabelText('ยืนยันรหัสผ่านใหม่'), 'Different123!');
    await user.click(screen.getByRole('button', { name: 'ตั้งรหัสผ่านใหม่' }));

    expect(await screen.findByText('รหัสยืนยันมี 6 หลัก')).toBeInTheDocument();
    expect(screen.getByText('รหัสผ่านยืนยันไม่ตรงกัน')).toBeInTheDocument();
    expect(calls).toHaveLength(1); // only the forgot-password call
  });
});
