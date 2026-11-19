import { usePersistentState } from '../../components/usePersistentState';
import { POMODORO_PLANS, type PomodoroPlan, type PomodoroPlanId } from '../../domain/pomodoro';

export type PomodoroChoice = PomodoroPlanId | 'off';

/** Whether timers start in Pomodoro rounds, remembered per browser. */
export function usePomodoroPlan(): {
  choice: PomodoroChoice;
  plan: PomodoroPlan | null;
  setChoice: (choice: PomodoroChoice) => void;
} {
  const [choice, setChoice] = usePersistentState<PomodoroChoice>('tenk.pomodoro', 'off');
  const plan = choice === 'off' ? null : (POMODORO_PLANS[choice] ?? null);
  return { choice: plan ? choice : 'off', plan, setChoice };
}
