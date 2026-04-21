import { ReactNode, useMemo } from 'react';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { initializeDatabase } from './init';
import { AppDatabase } from './types';

export function DatabaseProvider({ children }: { children: ReactNode }) {
  return (
    <SQLiteProvider databaseName="citizen-pass.db" onInit={(db) => initializeDatabase(createNativeAdapter(db))}>
      {children}
    </SQLiteProvider>
  );
}

export function useDatabase(): AppDatabase {
  const db = useSQLiteContext();
  return useMemo(() => createNativeAdapter(db), [db]);
}

function createNativeAdapter(db: ReturnType<typeof useSQLiteContext>): AppDatabase {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: async (source, ...params) => {
      await db.runAsync(source, ...params);
    },
    getFirstAsync: (source, ...params) => db.getFirstAsync(source, ...params),
    getAllAsync: (source, ...params) => db.getAllAsync(source, ...params),
  };
}
