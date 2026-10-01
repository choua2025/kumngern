import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { TEST_USER } from '../../test/render-page';
import { AuthContext, type AuthContextValue } from './auth-context';
import { RedirectIfAuthenticated } from './RequireAuth';

function auth(status: 'authenticated' | 'anonymous'): AuthContextValue {
  return {
    state: status === 'authenticated' ? { status, user: TEST_USER } : { status, user: null },
    login: () => Promise.resolve(),
    register: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    setUser: () => undefined,
  };
}

function Where() {
  const location = useLocation();
  return <p>at {location.pathname + location.search}</p>;
}

function renderLogin(status: 'authenticated' | 'anonymous', from?: string) {
  render(
    <AuthContext.Provider value={auth(status)}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
        <Routes>
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <p>login form</p>
              </RedirectIfAuthenticated>
            }
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('RedirectIfAuthenticated', () => {
  it('shows the form while anonymous', () => {
    renderLogin('anonymous', '/recurring');
    expect(screen.getByText('login form')).toBeInTheDocument();
  });

  it('returns to the page the user asked for (regression: always went to /)', () => {
    renderLogin('authenticated', '/recurring?x=1');
    expect(screen.getByText('at /recurring?x=1')).toBeInTheDocument();
  });

  it('never follows a "from" that leaves the site', () => {
    renderLogin('authenticated', '//evil.com/phish');
    expect(screen.getByText('at /')).toBeInTheDocument();
  });
});
