export type RowValue = string | number | null;

export interface AppDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: RowValue[]): Promise<void>;
  getFirstAsync<T>(source: string, ...params: RowValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: RowValue[]): Promise<T[]>;
}
