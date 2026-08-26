interface DraftStorageBackend {
    readonly length: number;
    getItem(key: string): string | null;
    key(index: number): string | null;
    removeItem(key: string): void;
    setItem(key: string, value: string): void;
}

export interface TabDraftReadResult {
    value: string | null;
    /** True when the value is backed by sessionStorage and survives a reload. */
    durable: boolean;
}

export interface TabDraftStore {
    read(key: string): TabDraftReadResult;
    write(key: string, value: string): boolean;
    remove(key: string): boolean;
    clearPrefix(prefix: string): boolean;
}

/**
 * Creates a tab-scoped draft store with an in-memory safety net.
 *
 * Browsers can reject sessionStorage in private/restricted modes or when its
 * quota is exhausted. The volatile copy survives Next.js soft navigation, so
 * browser Back/Forward does not silently destroy form input. Callers still get
 * `durable: false` and can warn that a hard reload or tab close is unsafe.
 */
export function createTabDraftStore(
    getStorage: () => DraftStorageBackend,
    onVolatileStateChange: (hasVolatileDrafts: boolean) => void = () => undefined,
): TabDraftStore {
    const volatileDrafts = new Map<string, string>();
    const pendingDeleteKeys = new Set<string>();
    const pendingDeletePrefixes = new Set<string>();
    const revivedKeys = new Set<string>();
    let lastReportedVolatileState = false;

    const reportVolatileState = () => {
        // Tombstones protect against stale values being restored, but they do
        // not contain unsaved user input. Only volatile drafts need an unload
        // warning; otherwise a failed cleanup can warn on a pristine form.
        const nextState = volatileDrafts.size > 0;
        if (nextState === lastReportedVolatileState) return;
        lastReportedVolatileState = nextState;
        onVolatileStateChange(nextState);
    };

    const isPendingDelete = (key: string) => pendingDeleteKeys.has(key)
        || (!revivedKeys.has(key) && [...pendingDeletePrefixes].some((prefix) => key.startsWith(prefix)));

    const retryPendingDeletes = (storage: DraftStorageBackend) => {
        for (const key of [...pendingDeleteKeys]) {
            try {
                storage.removeItem(key);
                pendingDeleteKeys.delete(key);
            } catch {
                // Retry on the next successful storage access.
            }
        }

        for (const prefix of [...pendingDeletePrefixes]) {
            try {
                for (let index = storage.length - 1; index >= 0; index -= 1) {
                    const key = storage.key(index);
                    if (key?.startsWith(prefix) && !revivedKeys.has(key)) storage.removeItem(key);
                }
                pendingDeletePrefixes.delete(prefix);
                for (const key of [...revivedKeys]) {
                    if (key.startsWith(prefix)) revivedKeys.delete(key);
                }
            } catch {
                // Keep the prefix tombstone until every old value is removed.
            }
        }
        reportVolatileState();
    };

    return {
        read(key) {
            let storage: DraftStorageBackend | null = null;
            let storedValue: string | null = null;
            try {
                storage = getStorage();
                retryPendingDeletes(storage);
                storedValue = storage.getItem(key);
            } catch {
                storage = null;
            }

            // A failed remove must not let an older sessionStorage value come
            // back after the browser makes storage available again.
            if (isPendingDelete(key)) {
                if (storage) {
                    try {
                        storage.removeItem(key);
                        pendingDeleteKeys.delete(key);
                        return { value: null, durable: true };
                    } catch {
                        // Keep the tombstone until removal succeeds.
                    }
                }
                return { value: null, durable: false };
            }

            if (volatileDrafts.has(key)) {
                const volatileValue = volatileDrafts.get(key) ?? '';
                if (storage) {
                    try {
                        storage.setItem(key, volatileValue);
                        volatileDrafts.delete(key);
                        reportVolatileState();
                        return { value: volatileValue, durable: true };
                    } catch {
                        // Storage may be readable while writes still exceed quota.
                    }
                }
                return { value: volatileValue, durable: false };
            }

            return { value: storedValue, durable: storage !== null };
        },

        write(key, value) {
            pendingDeleteKeys.delete(key);
            try {
                const storage = getStorage();
                retryPendingDeletes(storage);
                storage.setItem(key, value);
                if ([...pendingDeletePrefixes].some((prefix) => key.startsWith(prefix))) {
                    revivedKeys.add(key);
                }
                volatileDrafts.delete(key);
                reportVolatileState();
                return true;
            } catch {
                if ([...pendingDeletePrefixes].some((prefix) => key.startsWith(prefix))) {
                    revivedKeys.add(key);
                }
                volatileDrafts.set(key, value);
                reportVolatileState();
                return false;
            }
        },

        remove(key) {
            volatileDrafts.delete(key);
            revivedKeys.delete(key);
            pendingDeleteKeys.add(key);
            reportVolatileState();
            try {
                const storage = getStorage();
                retryPendingDeletes(storage);
                storage.removeItem(key);
                pendingDeleteKeys.delete(key);
                reportVolatileState();
                return true;
            } catch {
                return false;
            }
        },

        clearPrefix(prefix) {
            pendingDeletePrefixes.add(prefix);
            for (const key of volatileDrafts.keys()) {
                if (key.startsWith(prefix)) volatileDrafts.delete(key);
            }
            for (const key of revivedKeys) {
                if (key.startsWith(prefix)) revivedKeys.delete(key);
            }
            reportVolatileState();

            try {
                const storage = getStorage();
                for (let index = storage.length - 1; index >= 0; index -= 1) {
                    const key = storage.key(index);
                    if (key?.startsWith(prefix)) storage.removeItem(key);
                }
                pendingDeletePrefixes.delete(prefix);
                for (const key of pendingDeleteKeys) {
                    if (key.startsWith(prefix)) pendingDeleteKeys.delete(key);
                }
                reportVolatileState();
                return true;
            } catch {
                return false;
            }
        },
    };
}

let volatileUnloadWarningInstalled = false;

const handleVolatileDraftUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    event.returnValue = '';
};

const browserDraftStore = createTabDraftStore(
    () => window.sessionStorage,
    (hasVolatileDrafts) => {
        if (hasVolatileDrafts && !volatileUnloadWarningInstalled) {
            window.addEventListener('beforeunload', handleVolatileDraftUnload);
            volatileUnloadWarningInstalled = true;
        } else if (!hasVolatileDrafts && volatileUnloadWarningInstalled) {
            window.removeEventListener('beforeunload', handleVolatileDraftUnload);
            volatileUnloadWarningInstalled = false;
        }
    },
);

export function readTabDraft(key: string): TabDraftReadResult {
    return browserDraftStore.read(key);
}

/** Returns true only when sessionStorage accepted the draft. */
export function writeTabDraft(key: string, value: string): boolean {
    return browserDraftStore.write(key, value);
}

export function removeTabDraft(key: string): boolean {
    return browserDraftStore.remove(key);
}

export function clearTabDrafts(prefix = 'swim-story:draft:'): boolean {
    return browserDraftStore.clearPrefix(prefix);
}
