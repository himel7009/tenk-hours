import { NavLink, Outlet } from 'react-router';
import { Toast } from '../components/Toast';
import { SyncIndicator } from '../features/account/SyncIndicator';
import { RunningTimerBar } from '../features/timer/RunningTimerBar';
import styles from './AppLayout.module.css';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink;

export function AppLayout() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <NavLink to="/" className={styles.wordmark} aria-label="Tenk home">
          <span className={styles.mark} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          Tenk
        </NavLink>
        <nav className={styles.nav} aria-label="Main">
          <NavLink to="/" end className={navClass}>
            Skills
          </NavLink>
          <NavLink to="/settings" className={navClass}>
            Settings
          </NavLink>
          <SyncIndicator />
        </nav>
      </header>

      <RunningTimerBar />

      <main className={styles.main}>
        <Outlet />
      </main>

      <Toast />
    </div>
  );
}
