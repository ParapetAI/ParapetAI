export class InMemoryVault {
  private readonly store: Map<string, string> = new Map();

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  get(key: string): string | undefined {
    return this.store.get(key);
  }
}

