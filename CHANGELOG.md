# Changelog

Releases are deployed from `main` to https://himel7009.github.io/tenk-hours/.

## 2026-11-20

- **To-dos belong to a domain or skill, and move on by themselves.** Pick where a to-do goes (a domain such as Problem solving, a skill such as Operating systems, or General) and it is planned for that domain's next working day on your routine. If it is not done that day, it moves to the next working day by itself, marked with how many times it moved. Today groups to-dos by domain and skill, with what is coming up below. Click a to-do to rename it, move it or plan it for another day.
- **To-do history.** Day by day: what you finished, and what was planned but moved on. Filter it by domain or skill.
- **Money.** A new page for your spending, built on the same idea as a monthly expense sheet. Money lives in sections (personal expense, meal, fund, or your own), each with a budget for the month that you add to whenever money comes in, and you can move money between sections without it counting as spending. Write an expense the way you would in a notebook, "130 bus", and pick the section. Each section shows what is left, a fair amount per day for the rest of the month, and a warning when the pace means it will run out early. A section can carry its balance into the next month. The month is listed day by day like the sheet, with the days nothing was written down pointed out.
- **Money report.** Spending by day, week or month against the one before, split by section and by kind of spending (transport, groceries, eating out, phone, fees and more, worked out from the words you use), the largest expenses, and a spending calendar.
- **Import from a sheet.** Download a month from Google Sheets as CSV and import it. Every item line becomes an entry, budgets come in as money added, and every total matches the sheet.
- The bad habits PIN now hides money too.

## 2026-11-19

- **Streak switch on every card.** A flame next to edit and delete turns a skill's, habit's or project's streak on or off in one click.
- **Live sync.** A change made on one device now shows on your other open devices within a second or two, instead of on their next check a minute later.
- **App updates.** An open or installed app now checks for a new version every half hour and when you come back to it, and offers a Reload button when one is ready.
- **Projects come first.** The Projects tab lists every project, in a domain or not, each tagged with its domain, so there is no need for a "Projects" domain to find them. The Today tab shows today's projects in their own section right after the to-dos, and the domain panels below leave them out. New projects start with a streak, which can still be switched off.
- **Today tab.** The home page opens on Today: your to-do list, a reminder if a bad habit is still unanswered, and only the domains and trackers your weekly routine plans for today. It changes by itself from day to day, and says which domains are resting.
- **To-do list.** Write a task, tick it off, click it to fix a typo. Done items fold away until you clear them. It syncs with your account like everything else.
- **Activity calendar, like GitHub's.** One square per day for the last 12 months (or any past year), darker on the days you put in more time, with weekday and month labels, a Less to More legend, active days and your longest and current runs. Hover a square to see that day. It is on the home page for everything together, on every domain, and on every skill, habit and project page, where it replaces the old 26-week view. The 10,000-hour grid is unchanged.
- **Streaks are optional.** Every skill, habit and project has a "Keep a streak" switch. Turn it off and the hours, 10,000-hour grid, activity map, daily goal and report all stay; only the streak goes. Projects can now keep a streak too, with their own daily goal.
- **Plan your week.** Pick the days for each domain (AI on Sunday, problem solving and maths on Monday) and for anything outside a domain. Skills follow their domain's days. Home shows the week at a glance and today's goals count only what is planned. A day off never breaks a streak, and time put in on a day off still counts. The report counts daily goals only on planned days.
- **Library progress in percent.** Each book and course with a known length shows how far along it is in percent and how many lessons, chapters or pages are left. The top of the library sums it up: how many you have started, the average done, how many are almost finished (75% or more) and how many are finished. The Report page gets a Library card with the same picture for everything in progress.
- **Weekly and monthly report.** A new Report page shows how a week or month went: total time against the same point of the period before, daily average, days you showed up, daily goals reached and your best day. A chart breaks the time down by day, and another compares the last 8 weeks or 6 months; tap a bar to open that period. Below, every skill, habit, project and domain is listed with its time and change, plus clean days for bad habits (hidden while they are locked).
- **Work in rounds (Pomodoro).** Split any timer into 25 minute rounds with 5 minute breaks (a longer break after every fourth), or 50 and 10. Set 2 hours or 5 and the rounds and breaks are worked out for you, with a preview of when you will finish. Breaks never count towards your time, and after each break the clock waits until you start the next round.

## 2026-11-18

- **PIN lock for bad habits.** Hide your bad habits behind a 4 to 8 digit PIN on each device. They lock again when you leave the tab, put the app in the background or reload.
- **Bad habits.** Track habits you want to quit with one question a day: did you stay away from it? Clean days build a streak; the last week can be filled in or corrected with a tap.
- **New home layout.** On wide screens the overview stays on the left while your trackers sit on the right, in tabs for domains, skills, projects and habits. Domains can be collapsed. On phones the tabs come straight after today's summary.
- **Up next in the library.** Each book and course shows the lesson, chapter or page to start on next.
- **Daily plan for domains.** A domain adds up its skills' daily goals into one plan ("3h a day") and shows how much of it you have covered today. Domains also show their longest streak.
- **Projects.** A third kind of tracker that just adds up the time you spend, with no target or streak. Projects can sit in a domain, and a skill can be switched to a project or back.
- **Pause the timer.** Pause and resume a running timer; time spent paused does not count.
- **Seconds in custom timers.** Set a custom length in hours, minutes and seconds.

## 2026-11-16

- **Library: saved for later.** Keep courses and books you want to take up, then start one with a click.
- **Shortcuts on cards.** Edit or delete a skill or habit straight from the home page.
- **Domains.** Group skills under a field such as AI. A domain shows its skills' combined hours and keeps its own streak.
- **Day and year progress.** How much of today and of the year has passed, and how much is left.
- **Dashboard home page.** Today's time against each daily goal, a 7-day chart split by skill, and cards for domains, skills and habits.

## 2026-11-15

- **Library.** Track books and courses with chapter, page or lesson progress, a bookmark and notes.

## 2026-11-12

- **Habits** alongside skills, each with an emoji icon.
- **Per-skill streaks with daily goals.** A day counts only once its goal is reached.
- **Countdown timer** that saves the session when it ends, with a chime and notification.

## 2026-11-11

- **Accounts and cloud sync** with Google or email sign-in, built on Supabase with row level security.

## 2026-11-10

- **First release.** Skills, timer and manual logging, the 10,000-hour grid, streaks, heatmap, milestones, backups and an installable PWA.
