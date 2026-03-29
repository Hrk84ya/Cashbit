import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ShortcutCallbacks {
  onNewTransaction?: () => void;
  onSearch?: () => void;
}

export function useKeyboardShortcuts(callbacks?: ShortcutCallbacks) {
  const navigate = useNavigate();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Don't trigger when typing in inputs/textareas/selects
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case 'n':
          e.preventDefault();
          callbacks?.onNewTransaction?.();
          break;
        case '/':
          e.preventDefault();
          callbacks?.onSearch?.();
          break;
        case 'd':
          e.preventDefault();
          navigate('/');
          break;
        case 't':
          e.preventDefault();
          navigate('/transactions');
          break;
        case 'b':
          e.preventDefault();
          navigate('/budgets');
          break;
        case 'Escape':
          // Handled by individual modals
          break;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, callbacks]);
}
