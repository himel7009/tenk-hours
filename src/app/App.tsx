import { HashRouter, Route, Routes } from 'react-router';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SkillListPage } from '../features/skills/SkillListPage';
import { SkillPage } from '../features/skills/SkillPage';
import { AppLayout } from './AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { useApplyTheme } from './useApplyTheme';

export function App() {
  useApplyTheme();

  // Hash routing keeps deep links working on static hosts such as GitHub Pages.
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<SkillListPage />} />
          <Route path="skills/:skillId" element={<SkillPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
