/**
 * 会话内查找条：Cmd+F 唤起，全会话消息级查找（走 /api/sessions/find）。
 * PreviewPanel 的 Cmd+F 用 capture+stopPropagation 拦截，preview 打开时
 * 本组件的 bubble 监听收不到事件，天然让位。
 * 查找状态 keyed by session 常驻（切走再切回仍在）；mark 渲染由
 * ChatMessageSurface 的 active gate 管控，本组件只负责 UI 条与查询编排。
 */
import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../../stores';
import { sessionScopedValue } from '../../stores/session-slice';
import { runChatFind, stepChatFind } from '../../stores/chat-find-actions';
import { ClassicFindBox } from '../../ui/ClassicFindBox';
import { useI18n } from '../../hooks/use-i18n';
import styles from './Chat.module.css';

const FIND_DEBOUNCE_MS = 300;

export function ChatFindBar() {
  const { t } = useI18n();
  const currentPath = useStore(s => s.currentSessionPath);
  const welcomeVisible = useStore(s => s.welcomeVisible);
  const findState = useStore(s => (
    currentPath ? sessionScopedValue(s, s.chatFindBySession, currentPath) : undefined
  ));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') return;
      if (event.defaultPrevented) return; // preview 等更高优先级已消费
      const state = useStore.getState();
      const path = state.currentSessionPath;
      if (!path || state.welcomeVisible) return;
      event.preventDefault();
      state.openChatFind(path);
    };
    window.addEventListener('keydown', onKeyDown); // bubble 阶段，preview 的 capture 拦截天然优先
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleQueryChange = useCallback((query: string) => {
    if (!currentPath) return;
    useStore.getState().setChatFindQuery(currentPath, query);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runChatFind(currentPath, query);
    }, FIND_DEBOUNCE_MS);
  }, [currentPath]);

  if (!currentPath || welcomeVisible || !findState?.open) return null;

  return (
    <div className={styles.chatFindBarHost}>
      <ClassicFindBox
        open
        query={findState.query}
        resultIndex={Math.max(0, findState.activePos)}
        resultCount={findState.total}
        placeholder={t('chat.find.placeholder')}
        onQueryChange={handleQueryChange}
        onPrevious={() => stepChatFind(currentPath, -1)}
        onNext={() => stepChatFind(currentPath, 1)}
        onClose={() => useStore.getState().closeChatFind(currentPath)}
      />
    </div>
  );
}
