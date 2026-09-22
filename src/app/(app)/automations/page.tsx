import { requireOwner } from '@/lib/session';
import {
  AUTOMATION_LIBRARY,
  listAutomations,
  pendingTasks,
  recentTaskRuns,
} from '@/lib/automations/engine';
import { FOLLOW_UP_TEMPLATES } from '@/lib/ai/drafts';
import { Card, PageHeader } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/dates';
import {
  cancelTaskAction,
  toggleAutomationAction,
  updateAutomationOptionsAction,
  updateFollowUpAction,
} from '@/actions/settings';

export const metadata = { title: 'Automations' };
export const dynamic = 'force-dynamic';

interface FollowUpStage {
  day: number;
  enabled: boolean;
  template: string | null;
}

export default async function AutomationsPage() {
  const { business } = await requireOwner();
  const automations = listAutomations(business.id);
  const queued = pendingTasks(business.id, 20);
  const recent = recentTaskRuns(business.id, 12);

  const followUp = automations.find((a) => a.key === 'quote_follow_up');
  const stages: FollowUpStage[] = (() => {
    try {
      return (JSON.parse(followUp?.config ?? '{}').stages as FollowUpStage[]) ?? [];
    } catch {
      return [];
    }
  })();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Work that happens without you"
        title="Automations"
        description="Each of these is a real rule with a real queue behind it. Turn one off and anything it has pending is cancelled."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {automations.map((automation) => {
            const definition = automation.definition ?? AUTOMATION_LIBRARY.find((d) => d.key === automation.key);
            return (
              <Card key={automation.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold text-ink">{automation.name}</h2>
                    <p className="mt-0.5 text-sm text-ink-muted">{automation.description}</p>
                  </div>
                  <form action={toggleAutomationAction} className="shrink-0">
                    <input type="hidden" name="key" value={automation.key} />
                    <input type="hidden" name="enabled" value={automation.enabled ? 'no' : 'yes'} />
                    <button
                      type="submit"
                      className={`btn btn-sm ${automation.enabled ? 'btn-secondary' : 'btn-primary'}`}
                    >
                      {automation.enabled ? 'Turn off' : 'Turn on'}
                    </button>
                  </form>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <span className={`badge ${automation.enabled ? 'badge-good' : 'badge-neutral'}`}>
                    {automation.enabled ? 'Running' : 'Off'}
                  </span>
                  {automation.pending ? (
                    <span className="badge badge-info">{automation.pending} queued</span>
                  ) : null}
                  <span className="text-2xs text-ink-faint">Run {automation.run_count} times</span>
                </div>

                {definition ? (
                  <ol className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-2">
                    {definition.steps.map((step, i) => (
                      <li key={step} className="flex items-center gap-1.5">
                        <span className="rounded-sm border border-line bg-paper-sunken px-2 py-1 text-2xs font-medium text-ink-muted">
                          {step}
                        </span>
                        {i < definition.steps.length - 1 ? (
                          <span aria-hidden className="text-line-strong">
                            →
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : null}

                {automation.key === 'quote_follow_up' ? (
                  <form action={updateFollowUpAction} className="mt-5 space-y-4 border-t border-line pt-4">
                    {[1, 2, 3].map((n) => {
                      const stage = stages[n - 1] ?? { day: n * 2, enabled: true, template: null };
                      return (
                        <div key={n} className="rounded border border-line p-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold text-ink">Follow-up {n}</span>
                            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                              send after
                              <input
                                name={`day${n}`}
                                type="number"
                                min="1"
                                max="60"
                                defaultValue={stage.day}
                                className="input w-16 py-1 text-xs tabular"
                              />
                              days
                            </label>
                            <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted">
                              <input
                                name={`enabled${n}`}
                                type="checkbox"
                                value="yes"
                                defaultChecked={stage.enabled !== false}
                                className="h-4 w-4 accent-[#1f6b3f]"
                              />
                              On
                            </label>
                          </div>
                          <textarea
                            name={`template${n}`}
                            rows={2}
                            defaultValue={stage.template ?? ''}
                            placeholder={FOLLOW_UP_TEMPLATES[n]}
                            className="input mt-2 min-h-0 text-sm"
                          />
                        </div>
                      );
                    })}
                    <p className="text-xs text-ink-faint">
                      Available placeholders:{' '}
                      <code className="rounded-sm bg-paper-sunken px-1 text-2xs">{'{{first_name}}'}</code>{' '}
                      <code className="rounded-sm bg-paper-sunken px-1 text-2xs">{'{{business}}'}</code>{' '}
                      <code className="rounded-sm bg-paper-sunken px-1 text-2xs">{'{{service}}'}</code>{' '}
                      <code className="rounded-sm bg-paper-sunken px-1 text-2xs">{'{{amount}}'}</code>
                    </p>
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Save sequence
                    </button>
                  </form>
                ) : null}

                {automation.key === 'job_completed' ? (
                  <form action={updateAutomationOptionsAction} className="mt-5 space-y-3 border-t border-line pt-4">
                    <input type="hidden" name="key" value="job_completed" />
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input name="autoInvoice" type="checkbox" value="yes" defaultChecked className="h-4 w-4 accent-[#1f6b3f]" />
                      Raise and send the invoice when a job is marked complete
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input name="requestReview" type="checkbox" value="yes" defaultChecked className="h-4 w-4 accent-[#1f6b3f]" />
                      Ask for a review afterwards
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        Invoice due in
                        <input name="dueInDays" type="number" min="0" defaultValue={14} className="input w-16 py-1 text-xs tabular" />
                        days
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                        Ask for a review after
                        <input name="reviewDelayDays" type="number" min="0" defaultValue={1} className="input w-16 py-1 text-xs tabular" />
                        days
                      </label>
                    </div>
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Save
                    </button>
                  </form>
                ) : null}

                {automation.key === 'new_lead' ? (
                  <form action={updateAutomationOptionsAction} className="mt-5 space-y-3 border-t border-line pt-4">
                    <input type="hidden" name="key" value="new_lead" />
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input name="notifyOwner" type="checkbox" value="yes" defaultChecked className="h-4 w-4 accent-[#1f6b3f]" />
                      Put it at the top of my activity feed
                    </label>
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input name="confirmCustomer" type="checkbox" value="yes" defaultChecked className="h-4 w-4 accent-[#1f6b3f]" />
                      Send the customer a confirmation
                    </label>
                    <textarea
                      name="confirmTemplate"
                      rows={2}
                      className="input min-h-0 text-sm"
                      defaultValue="Thanks {{first_name}} — we got your {{service}} request. {{business}} will be back to you with a quote shortly."
                    />
                    <button type="submit" className="btn btn-secondary btn-sm">
                      Save
                    </button>
                  </form>
                ) : null}
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card title={`Queued (${queued.length})`} bodyClassName="">
            {queued.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ink-muted sm:px-5">Nothing waiting to run.</p>
            ) : (
              <ul className="divide-y divide-line">
                {queued.map((task) => (
                  <li key={task.id} className="flex items-start gap-2 px-4 py-2.5 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink">
                        {task.kind === 'quote_follow_up' ? 'Quote follow-up' : 'Review request'}
                      </p>
                      <p className="text-xs text-ink-faint">
                        {task.customer_name ?? 'Customer'} ·{' '}
                        {formatDate(task.run_at.slice(0, 10), { weekday: false })}
                      </p>
                    </div>
                    <form action={cancelTaskAction}>
                      <input type="hidden" name="taskId" value={task.id} />
                      <button
                        type="submit"
                        className="text-2xs font-semibold text-ink-faint hover:text-status-critical"
                      >
                        Cancel
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Recently run" bodyClassName="">
            {recent.length === 0 ? (
              <p className="px-4 py-5 text-sm text-ink-muted sm:px-5">Nothing has run yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {recent.map((task) => (
                  <li key={task.id} className="px-4 py-2.5 sm:px-5">
                    <p className="text-sm text-ink">{task.result ?? task.kind}</p>
                    <p className="text-2xs text-ink-faint">
                      {task.status} · {relativeTime(task.ran_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="How this runs">
            <p className="text-sm leading-relaxed text-ink-muted">
              Scheduled work is stored in the database, not in memory, and is drained every time the
              app is used. It survives restarts and deploys. For minute-accurate timing on a quiet
              account, point a cron at{' '}
              <code className="rounded-sm bg-paper-sunken px-1 text-2xs">/api/cron/automations</code>.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
