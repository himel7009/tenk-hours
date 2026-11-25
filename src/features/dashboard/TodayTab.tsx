import { Button } from '../../components/Button';
import { TodoList } from '../todos/TodoList';
import styles from './HomePage.module.css';

interface TodayTabProps {
  /** Bad habits not yet answered today; zero while they are locked away. */
  unanswered: number;
  onOpenBadHabits: () => void;
}

/**
 * The Today tab: the day's to-dos and nothing else. Each group's name opens
 * its skill, habit or project; domains, skills, projects and habits have
 * their own tabs.
 */
export function TodayTab({ unanswered, onOpenBadHabits }: TodayTabProps) {
  return (
    <div className={styles.todayTab}>
      <TodoList />

      {unanswered > 0 && (
        <p className={styles.todayNudge}>
          {unanswered === 1 ? '1 bad habit' : `${unanswered} bad habits`} to answer today.{' '}
          <Button size="sm" variant="quiet" onClick={onOpenBadHabits}>
            Answer now
          </Button>
        </p>
      )}
    </div>
  );
}
