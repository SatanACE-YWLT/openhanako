import { useRef, useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '../store';
import { hanaFetch } from '../api';
import { t } from '../helpers';
import { renderMarkdown } from '../../utils/markdown';
import { useMermaidDiagrams } from '../../hooks/use-mermaid-diagrams';
import { Overlay } from '../../ui';
import styles from '../Settings.module.css';

interface WeekDay {
  date: string;
  body: string;
}

export function CompiledMemoryViewer() {
  const [visible, setVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sections, setSections] = useState({ facts: '', today: '', week: '', longterm: '' });
  const [factsDraft, setFactsDraft] = useState('');
  const [todayDraft, setTodayDraft] = useState('');
  const [longtermDraft, setLongtermDraft] = useState('');
  const [weekDays, setWeekDays] = useState<WeekDay[]>([]);
  const [weekDrafts, setWeekDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingFacts, setSavingFacts] = useState(false);
  const [savingToday, setSavingToday] = useState(false);
  const [savingLongterm, setSavingLongterm] = useState(false);
  const [savingDay, setSavingDay] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useMermaidDiagrams(contentRef, [sections, loading, editing]);

  useEffect(() => {
    const handler = () => { setVisible(true); setEditing(false); load(); };
    window.addEventListener('hana-view-compiled-memory', handler);
    return () => window.removeEventListener('hana-view-compiled-memory', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listener registered once for the component lifetime; `load` intentionally always reads the latest agent/store state when invoked, not a snapshot captured at mount
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/memories/compiled?agentId=${aid}`);
      const data = await res.json();
      const nextSections = {
        facts: data.sections?.facts || '',
        today: data.sections?.today || '',
        week: data.sections?.week || '',
        longterm: data.sections?.longterm || '',
      };
      setSections(nextSections);
      setFactsDraft(nextSections.facts);
      setTodayDraft(nextSections.today);
      setLongtermDraft(nextSections.longterm);
      await loadWeekDays(aid);
    } catch (err: any) {
      setSections({ facts: '', today: '', week: '', longterm: '' });
      setFactsDraft('');
      setTodayDraft('');
      setLongtermDraft('');
      setWeekDays([]);
      setWeekDrafts({});
      useSettingsStore.getState().showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadWeekDays = async (aid: string | null) => {
    try {
      const res = await hanaFetch(`/api/memories/compiled/week/days?agentId=${aid}`);
      const data = await res.json();
      const days: WeekDay[] = Array.isArray(data.days) ? data.days : [];
      setWeekDays(days);
      setWeekDrafts(Object.fromEntries(days.map((d) => [d.date, d.body])));
    } catch (err: any) {
      setWeekDays([]);
      setWeekDrafts({});
      useSettingsStore.getState().showToast(err.message, 'error');
    }
  };

  const clearCompiled = async () => {
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      await hanaFetch(`/api/memories/compiled?agentId=${aid}`, { method: 'DELETE' });
      setSections(prev => ({ ...prev, today: '', week: '', longterm: '' }));
      setTodayDraft('');
      setLongtermDraft('');
      setWeekDays([]);
      setWeekDrafts({});
      useSettingsStore.getState().showToast(t('settings.memory.compiledCleared'), 'success');
    } catch (err: any) {
      useSettingsStore.getState().showToast(err.message, 'error');
    }
  };

  const saveFacts = async () => {
    setSavingFacts(true);
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/memories/compiled/facts?agentId=${aid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facts: factsDraft }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const savedFacts = typeof data.facts === 'string' ? data.facts : factsDraft;
      setFactsDraft(savedFacts);
      setSections(prev => ({ ...prev, facts: savedFacts }));
      useSettingsStore.getState().showToast(t('settings.memory.factsSaved'), 'success');
    } catch (err: any) {
      useSettingsStore.getState().showToast(err.message, 'error');
    } finally {
      setSavingFacts(false);
    }
  };

  const saveToday = async () => {
    setSavingToday(true);
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/memories/compiled/today?agentId=${aid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ today: todayDraft }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const savedToday = typeof data.today === 'string' ? data.today : todayDraft;
      setTodayDraft(savedToday);
      setSections(prev => ({ ...prev, today: savedToday }));
      useSettingsStore.getState().showToast(t('settings.memory.todaySaved'), 'success');
    } catch (err: any) {
      useSettingsStore.getState().showToast(err.message, 'error');
    } finally {
      setSavingToday(false);
    }
  };

  const saveLongterm = async () => {
    setSavingLongterm(true);
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const res = await hanaFetch(`/api/memories/compiled/longterm?agentId=${aid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ longterm: longtermDraft }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const savedLongterm = typeof data.longterm === 'string' ? data.longterm : longtermDraft;
      setLongtermDraft(savedLongterm);
      setSections(prev => ({ ...prev, longterm: savedLongterm }));
      useSettingsStore.getState().showToast(t('settings.memory.longtermSaved'), 'success');
    } catch (err: any) {
      useSettingsStore.getState().showToast(err.message, 'error');
    } finally {
      setSavingLongterm(false);
    }
  };

  const saveWeekDay = async (date: string) => {
    setSavingDay(date);
    try {
      const aid = useSettingsStore.getState().getSettingsAgentId();
      const draft = weekDrafts[date] ?? '';
      const res = await hanaFetch(`/api/memories/compiled/week/days/${date}?agentId=${aid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const savedBody = typeof data.body === 'string' ? data.body : draft;
      setWeekDrafts(prev => ({ ...prev, [date]: savedBody }));
      setWeekDays(prev => prev.map((d) => (d.date === date ? { ...d, body: savedBody } : d)));
      // week.md 已在服务端从 daily/ 重新装配，刷新 sections.week 供切回查看态时展示最新内容
      const refreshed = await hanaFetch(`/api/memories/compiled?agentId=${aid}`);
      const refreshedData = await refreshed.json();
      if (typeof refreshedData.sections?.week === 'string') {
        setSections(prev => ({ ...prev, week: refreshedData.sections.week }));
      }
      useSettingsStore.getState().showToast(t('settings.memory.daySaved'), 'success');
    } catch (err: any) {
      useSettingsStore.getState().showToast(err.message, 'error');
    } finally {
      setSavingDay(null);
    }
  };

  const close = useCallback(() => setVisible(false), []);
  const toggleEditing = useCallback(() => setEditing((prev) => !prev), []);
  const readonlyBlocks = [
    { key: 'today', title: t('settings.memory.sections.today'), value: sections.today },
    { key: 'week', title: t('settings.memory.sections.week'), value: sections.week },
    { key: 'longterm', title: t('settings.memory.sections.longterm'), value: sections.longterm },
  ];

  return (
    <Overlay
      open={visible}
      onClose={close}
      backdrop="blur"
      zIndex={100}
      className={styles['memory-viewer']}
      backdropClassName={styles['memory-viewer-backdrop']}
      disableContainerAnimation
    >
        <div className={styles['memory-viewer-header']}>
          <h3 className={styles['memory-viewer-title']}>{t('settings.memory.compiled')}</h3>
          <div className={styles['memory-viewer-header-actions']}>
            <button className={styles['compiled-edit-toggle-btn']} onClick={toggleEditing}>
              {editing ? t('settings.memory.editDone') : t('settings.memory.editEntry')}
            </button>
            <button className={styles['compiled-clear-btn']} onClick={clearCompiled}>
              {t('settings.memory.compiledClear')}
            </button>
            <button className={styles['memory-viewer-close']} onClick={close}>✕</button>
          </div>
        </div>
        <div className={`${styles['memory-viewer-body']} ${styles['compiled-memory-body']}`}>
          {loading ? (
            <div className="memory-viewer-empty">Loading...</div>
          ) : editing ? (
            <div className={styles['compiled-memory-editable']}>
              <section className={styles['compiled-memory-edit-section']}>
                <label className={styles['compiled-memory-editor-label']} htmlFor="compiled-memory-today-editor">
                  {t('settings.memory.sections.today')}
                </label>
                <textarea
                  id="compiled-memory-today-editor"
                  className={styles['compiled-memory-facts-editor']}
                  value={todayDraft}
                  onChange={(event) => setTodayDraft(event.target.value)}
                  disabled={savingToday}
                />
                <div className={styles['compiled-memory-editor-actions']}>
                  <button
                    type="button"
                    className={styles['compiled-memory-save-btn']}
                    onClick={saveToday}
                    disabled={savingToday}
                  >
                    {t('settings.memory.saveToday')}
                  </button>
                </div>
              </section>

              <section className={styles['compiled-memory-edit-section']}>
                <label className={styles['compiled-memory-editor-label']} htmlFor="compiled-memory-facts-editor">
                  {t('settings.memory.editableFactsLabel')}
                </label>
                <textarea
                  id="compiled-memory-facts-editor"
                  className={styles['compiled-memory-facts-editor']}
                  value={factsDraft}
                  onChange={(event) => setFactsDraft(event.target.value)}
                  disabled={savingFacts}
                />
                <div className={styles['compiled-memory-editor-actions']}>
                  <button
                    type="button"
                    className={styles['compiled-memory-save-btn']}
                    onClick={saveFacts}
                    disabled={savingFacts}
                  >
                    {t('settings.memory.saveFacts')}
                  </button>
                </div>
              </section>

              <section className={styles['compiled-memory-edit-section']}>
                <div className={styles['compiled-memory-editor-label']}>
                  {t('settings.memory.sections.week')}
                </div>
                {weekDays.length === 0 ? (
                  <div className="memory-viewer-empty">{t('settings.memory.compiledEmpty')}</div>
                ) : (
                  <div className={styles['compiled-memory-week-days']}>
                    {weekDays.map((day) => (
                      <div className={styles['compiled-memory-week-day-row']} key={day.date}>
                        <div className={styles['compiled-memory-week-day-label']}>{day.date}</div>
                        <textarea
                          aria-label={day.date}
                          className={styles['compiled-memory-week-day-editor']}
                          value={weekDrafts[day.date] ?? ''}
                          onChange={(event) => setWeekDrafts(prev => ({ ...prev, [day.date]: event.target.value }))}
                          disabled={savingDay === day.date}
                        />
                        <div className={styles['compiled-memory-editor-actions']}>
                          <button
                            type="button"
                            className={styles['compiled-memory-save-btn']}
                            onClick={() => saveWeekDay(day.date)}
                            disabled={savingDay === day.date}
                          >
                            {t('settings.memory.saveDay')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles['compiled-memory-edit-section']}>
                <label className={styles['compiled-memory-editor-label']} htmlFor="compiled-memory-longterm-editor">
                  {t('settings.memory.sections.longterm')}
                </label>
                <textarea
                  id="compiled-memory-longterm-editor"
                  className={styles['compiled-memory-facts-editor']}
                  value={longtermDraft}
                  onChange={(event) => setLongtermDraft(event.target.value)}
                  disabled={savingLongterm}
                />
                <div className={styles['compiled-memory-editor-actions']}>
                  <button
                    type="button"
                    className={styles['compiled-memory-save-btn']}
                    onClick={saveLongterm}
                    disabled={savingLongterm}
                  >
                    {t('settings.memory.saveLongterm')}
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <div className={styles['compiled-memory-editable']}>
              <label className={styles['compiled-memory-editor-label']} htmlFor="compiled-memory-facts-editor">
                {t('settings.memory.editableFactsLabel')}
              </label>
              <textarea
                id="compiled-memory-facts-editor"
                className={styles['compiled-memory-facts-editor']}
                value={factsDraft}
                onChange={(event) => setFactsDraft(event.target.value)}
                disabled={savingFacts}
              />
              <div className={styles['compiled-memory-editor-actions']}>
                <button
                  type="button"
                  className={styles['compiled-memory-save-btn']}
                  onClick={saveFacts}
                  disabled={savingFacts}
                >
                  {t('settings.memory.saveFacts')}
                </button>
              </div>
              <div className={styles['compiled-memory-readonly-title']}>
                {t('settings.memory.readonlyTimelineTitle')}
              </div>
              <div ref={contentRef} className={styles['compiled-memory-readonly-list']}>
                {readonlyBlocks.map(block => (
                  <section className={styles['compiled-memory-readonly-block']} key={block.key}>
                    <h4>{block.title}</h4>
                    {block.value.trim() ? (
                      <div
                        className={`${styles['compiled-memory-md']} ${'md-content'}`}
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(block.value) }}
                      />
                    ) : (
                      <div className="memory-viewer-empty">{t('settings.memory.compiledEmpty')}</div>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
    </Overlay>
  );
}
