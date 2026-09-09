import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type HomeEditContextValue = {
  editing: boolean;
  setEditing: (editing: boolean) => void;
};

const HomeEditContext = createContext<HomeEditContextValue | null>(null);

const HomeEditProvider = ({ children }: { children: ReactNode }) => {
  const [editing, setEditing] = useState(false);
  const value = useMemo(() => ({ editing, setEditing }), [editing]);
  return <HomeEditContext.Provider value={value}>{children}</HomeEditContext.Provider>;
};

const useHomeEdit = () => {
  const ctx = useContext(HomeEditContext);
  if (!ctx) {
    return {
      editing: false,
      setEditing: (_editing: boolean) => {
        void _editing;
      },
    };
  }
  return ctx;
};

export { HomeEditProvider, useHomeEdit };
