import { useEffect } from 'react';
import { HashRouter, Route, Routes, useNavigate } from 'react-router';
import { ResetPasswordPage } from '../features/account/ResetPasswordPage';
import { SignInPage } from '../features/account/SignInPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SkillListPage } from '../features/skills/SkillListPage';
import { SkillPage } from '../features/skills/SkillPage';
import { useAccountStore } from '../store/accountStore';
import { useCloudSync } from '../sync/useCloudSync';
import { AppLayout } from './AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { useApplyTheme } from './useApplyTheme';

export function App() {
  useApplyTheme();
  useCloudSync();

  // Hash routing keeps deep links working on static hosts such as GitHub Pages.
  return (
    <HashRouter>
      <PasswordRecoveryRedirect />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<SkillListPage />} />
          <Route path="skills/:skillId" element={<SkillPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="sign-in" element={<SignInPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

/** Sends someone arriving from a password reset email to the new-password form. */
function PasswordRecoveryRedirect() {
  const navigate = useNavigate();
  const passwordRecovery = useAccountStore((state) => state.passwordRecovery);

  useEffect(() => {
    if (passwordRecovery) void navigate('/reset-password', { replace: true });
  }, [passwordRecovery, navigate]);

  return null;
}
