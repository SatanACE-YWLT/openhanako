/**
 * WorkflowCard — 右侧「Workflow」卡（学 Claude 进度感）
 *
 * 从统一 Agent Activity 真相源筛 kind=workflow，按当前对话展示后台 workflow 任务。
 * running 状态圈旋转 + 实时「已运行 Xs」，done/failed 定格 + 「耗时 Xs」。无 workflow 时返回 null。
 */
import { useEffect, useState } from 'react';
import { useStore } from '../../stores';
import { selectAgentActivities, type AgentActivityEntry } from '../../stores/agent-activity-slice';
import { formatElapsed } from '../../utils/format-duration';
import styles from './WorkflowCard.module.css';

const STATUS_ICON: Record<AgentActivityEntry['status'], string> = {
  running: '◐',
  done: '✓',
  failed: '✗',
  aborted: '⊘',
};

function rank(status: AgentActivityEntry['status']): number {
  return status === 'running' ? 0 : 1;
}

/** running 显示「已运行 Xs」（实时），终态显示「耗时 Xs」（总时长）。缺 startedAt 则空。 */
function durationLabel(w: AgentActivityEntry, now: number, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (w.status === 'running' && w.startedAt) {
    return t('rightWorkspace.workflow.running', { text: formatElapsed(now - w.startedAt) });
  }
  if (w.finishedAt && w.startedAt) {
    return t('activity.duration', { text: formatElapsed(w.finishedAt - w.startedAt) });
  }
  return '';
}

export function WorkflowCard() {
  const sessionPath = useStore((s) => s.currentSessionPath);
  const all = useStore(selectAgentActivities(sessionPath));
  const [now, setNow] = useState(() => Date.now());

  const workflows = all.filter((a) => a.kind === 'workflow');
  const hasRunning = workflows.some((w) => w.status === 'running');

  // running 时每秒 tick 刷新「已运行」时长；无 running 时不开定时器，组件卸载/状态终结即清理。
  useEffect(() => {
    if (!hasRunning) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [hasRunning]);

  if (!workflows.length) return null;

  const t = window.t ?? ((k: string) => k);
  const sorted = [...workflows].sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return (b.startedAt ?? 0) - (a.startedAt ?? 0);
  });

  return (
    <section className={`jian-card ${styles.card}`} aria-label="Workflow">
      <div className={styles.header}>
        <span className={styles.title}>{t('rightWorkspace.workflow.title')}</span>
        <span className={styles.count}>{sorted.length}</span>
      </div>
      <div className={styles.list}>
        {sorted.map((w) => {
          const dur = durationLabel(w, now, t);
          return (
            <div key={w.id} className={styles.row} data-status={w.status}>
              <span className={`${styles.statusIcon} ${styles[`status-${w.status}`] ?? ''}`} aria-hidden="true">
                {STATUS_ICON[w.status]}
              </span>
              <span className={styles.name} title={w.summary || ''}>{w.summary || w.id}</span>
              {dur && <span className={styles.duration}>{dur}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
