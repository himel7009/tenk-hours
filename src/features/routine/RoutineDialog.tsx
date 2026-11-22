import { useState } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import {
  normalizeRoutine,
  setWeekday,
  toggleWeekday,
  WEEKDAYS,
  type Weekday,
} from '../../domain/routine';
import type { Skill } from '../../domain/types';
import { useTrackerStore } from '../../store/trackerStore';
import styles from './routine.module.css';

const dayName = (weekday: number, style: 'short' | 'long') =>
  new Date(2023, 0, 1 + weekday).toLocaleDateString(undefined, { weekday: style });

const kindName = (skill: Skill) => skill.kind.charAt(0).toUpperCase() + skill.kind.slice(1);

const isOn = (days: readonly Weekday[], weekday: Weekday) =>
  days.length === 0 || days.includes(weekday);

/**
 * The whole routine in one grid: a row per skill, habit and project, a
 * column per weekday. Skills sit under their domain, whose row sets a day
 * for all of them at once. Changes save as they are made.
 */
export function RoutineDialog({ onClose }: { onClose: () => void }) {
  const domains = useTrackerStore((state) => state.domains);
  const skills = useTrackerStore((state) => state.skills);
  const setRoutine = useTrackerStore((state) => state.setRoutine);
  // Starting over edits a blank copy, saved all at once. Here no days means
  // none picked yet, not every day.
  const [draft, setDraft] = useState<Record<string, Weekday[]> | null>(null);

  const daysOf = (skill: Skill) => draft?.[skill.id] ?? skill.routineDays;
  const isChecked = (skill: Skill, weekday: Weekday) =>
    draft ? daysOf(skill).includes(weekday) : isOn(skill.routineDays, weekday);
  const toggle = (skill: Skill, weekday: Weekday) => {
    if (draft) {
      const days = daysOf(skill);
      setDraft({
        ...draft,
        [skill.id]: days.includes(weekday)
          ? days.filter((day) => day !== weekday)
          : [...days, weekday],
      });
    } else {
      setRoutine({ skillId: skill.id }, toggleWeekday(skill.routineDays, weekday));
    }
  };
  const setForAll = (members: Skill[], weekday: Weekday, on: boolean) => {
    if (draft) {
      const next = { ...draft };
      for (const member of members) {
        const days = (next[member.id] ?? []).filter((day) => day !== weekday);
        next[member.id] = on ? [...days, weekday] : days;
      }
      setDraft(next);
    } else {
      for (const member of members) {
        setRoutine({ skillId: member.id }, setWeekday(member.routineDays, weekday, on));
      }
    }
  };
  const startOver = () => setDraft(Object.fromEntries(skills.map((skill) => [skill.id, []])));
  const saveDraft = () => {
    if (!draft) return;
    // Anything left without days is planned for every day.
    for (const skill of skills) setRoutine({ skillId: skill.id }, normalizeRoutine(daysOf(skill)));
    setDraft(null);
  };
  const unpicked = draft ? skills.filter((skill) => daysOf(skill).length === 0).length : 0;

  const groups = [
    ...domains
      .map((domain) => ({
        key: domain.id,
        domain,
        members: skills.filter((skill) => skill.domainId === domain.id),
      }))
      .filter((group) => group.members.length > 0),
    { key: 'own', domain: null, members: skills.filter((skill) => skill.domainId === null) },
  ].filter((group) => group.members.length > 0);

  const trackerRow = (skill: Skill, inDomain: boolean) => (
    <tr key={skill.id} data-color={skill.color} data-member={inDomain || undefined}>
      <th scope="row">
        <span className={styles.rowName}>
          <span aria-hidden="true">{skill.icon}</span> {skill.name}
        </span>
        <span className={styles.rowNote}>
          {kindName(skill)}
          {draft
            ? daysOf(skill).length === 0 && ', no days picked yet'
            : skill.routineDays.length === 0 && ', every day'}
        </span>
      </th>
      {WEEKDAYS.map((weekday) => {
        const on = isChecked(skill, weekday);
        return (
          <td key={weekday}>
            <label className={styles.cell}>
              <input
                type="checkbox"
                className="visually-hidden"
                checked={on}
                // One day stays on: none at all would mean nothing.
                disabled={!draft && skill.routineDays.length === 1 && on}
                onChange={() => toggle(skill, weekday)}
              />
              <span className="visually-hidden">
                {skill.name} on {dayName(weekday, 'long')}
              </span>
            </label>
          </td>
        );
      })}
    </tr>
  );

  return (
    <Dialog title="Plan your week" onClose={onClose} size="wide">
      {draft ? (
        <p className={styles.draftNote} role="status">
          Starting over: every day is cleared. Pick the days for each one, then save. Anything left
          without days is planned for every day. Nothing changes until you save.
        </p>
      ) : (
        <p className={styles.lede}>
          Pick the days for each skill, habit and project. A domain&rsquo;s row sets a day for all
          its skills at once. A day off never breaks a streak, and time put in on a day off still
          counts.
        </p>
      )}
      {groups.length === 0 ? (
        <p className={styles.empty}>
          Add a skill, habit or project first, then plan its days here.
        </p>
      ) : (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Planned for</span>
                </th>
                {WEEKDAYS.map((weekday) => (
                  <th key={weekday} scope="col" abbr={dayName(weekday, 'long')}>
                    {dayName(weekday, 'short').slice(0, 2)}
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map(({ key, domain, members }) => (
              <tbody key={key}>
                {domain ? (
                  <tr className={styles.groupRow} data-color={domain.color}>
                    <th scope="rowgroup">
                      <span className={styles.rowName}>
                        <span aria-hidden="true">{domain.icon}</span> {domain.name}
                      </span>
                      <span className={styles.rowNote}>Same days for all its skills</span>
                    </th>
                    {WEEKDAYS.map((weekday) => {
                      const count = members.filter((m) => isChecked(m, weekday)).length;
                      const all = count === members.length;
                      return (
                        <td key={weekday}>
                          <label
                            className={styles.cell}
                            data-some={(count > 0 && !all) || undefined}
                          >
                            <input
                              type="checkbox"
                              className="visually-hidden"
                              checked={all}
                              onChange={() => setForAll(members, weekday, !all)}
                            />
                            <span className="visually-hidden">
                              {all ? 'Take all of' : 'Put all of'} {domain.name}{' '}
                              {all ? 'off' : 'on'} {dayName(weekday, 'long')}
                              {count > 0 && !all && `, ${count} of ${members.length} on now`}
                            </span>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ) : (
                  <tr className={styles.groupRow}>
                    <th scope="rowgroup" colSpan={8}>
                      <span className={styles.rowName}>Not in a domain</span>
                    </th>
                  </tr>
                )}
                {members.map((skill) => trackerRow(skill, domain !== null))}
              </tbody>
            ))}
          </table>
        </div>
      )}
      <div className={styles.dialogActions}>
        {draft ? (
          <>
            <Button variant="quiet" onClick={() => setDraft(null)}>
              Keep the old routine
            </Button>
            <Button variant="primary" onClick={saveDraft}>
              {unpicked > 0 ? `Save, ${unpicked} on every day` : 'Save new routine'}
            </Button>
          </>
        ) : (
          <>
            {skills.length > 0 && (
              <Button variant="quiet" onClick={startOver}>
                Start over
              </Button>
            )}
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
