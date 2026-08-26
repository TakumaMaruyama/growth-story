import assert from 'node:assert/strict';
import test from 'node:test';
import { createTabDraftStore } from './tab-draft-store';

class MemoryStorage {
    readonly values = new Map<string, string>();
    failReads = false;
    failWrites = false;

    get length() {
        return this.values.size;
    }

    getItem(key: string) {
        if (this.failReads) throw new Error('storage unavailable');
        return this.values.get(key) ?? null;
    }

    key(index: number) {
        return [...this.values.keys()][index] ?? null;
    }

    removeItem(key: string) {
        if (this.failWrites) throw new Error('storage unavailable');
        this.values.delete(key);
    }

    setItem(key: string, value: string) {
        if (this.failWrites) throw new Error('quota exceeded');
        this.values.set(key, value);
    }
}

test('tab draft store uses session storage when it is available', () => {
    const storage = new MemoryStorage();
    const store = createTabDraftStore(() => storage);

    assert.equal(store.write('draft:1', 'saved'), true);
    assert.deepEqual(store.read('draft:1'), { value: 'saved', durable: true });
    assert.equal(store.remove('draft:1'), true);
    assert.deepEqual(store.read('draft:1'), { value: null, durable: true });
});

test('tab draft store restores the newest volatile value after storage write failure', () => {
    const storage = new MemoryStorage();
    const volatileStates: boolean[] = [];
    const store = createTabDraftStore(() => storage, (state) => volatileStates.push(state));

    assert.equal(store.write('draft:1', 'old'), true);
    storage.failWrites = true;
    assert.equal(store.write('draft:1', 'new'), false);
    assert.deepEqual(store.read('draft:1'), { value: 'new', durable: false });
    assert.deepEqual(volatileStates, [true]);

    storage.failWrites = false;
    assert.deepEqual(store.read('draft:1'), { value: 'new', durable: true });
    assert.equal(storage.values.get('draft:1'), 'new');
    assert.deepEqual(volatileStates, [true, false]);
});

test('tab draft store retains drafts when storage access is completely blocked', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    storage.failWrites = true;
    const store = createTabDraftStore(() => storage);

    assert.equal(store.write('swim-story:draft:daily:1', 'daily'), false);
    assert.deepEqual(store.read('swim-story:draft:daily:1'), {
        value: 'daily',
        durable: false,
    });
    assert.equal(store.remove('swim-story:draft:daily:1'), false);
    assert.deepEqual(store.read('swim-story:draft:daily:1'), {
        value: null,
        durable: false,
    });
});

test('tab draft store reports blocked reads as non-durable even with no draft', () => {
    const storage = new MemoryStorage();
    storage.failReads = true;
    const store = createTabDraftStore(() => storage);

    assert.deepEqual(store.read('missing'), { value: null, durable: false });
});

test('failed deletion cannot resurrect an older stored draft', () => {
    const storage = new MemoryStorage();
    const safetyStates: boolean[] = [];
    const store = createTabDraftStore(() => storage, (state) => safetyStates.push(state));
    store.write('swim-story:draft:story', 'old draft');

    storage.failWrites = true;
    assert.equal(store.remove('swim-story:draft:story'), false);
    assert.deepEqual(safetyStates, []);
    storage.failWrites = false;
    assert.deepEqual(store.read('swim-story:draft:story'), { value: null, durable: true });
    assert.equal(storage.values.has('swim-story:draft:story'), false);
    assert.deepEqual(safetyStates, []);
});

test('failed prefix clear tombstones stored drafts until cleanup recovers', () => {
    const storage = new MemoryStorage();
    const store = createTabDraftStore(() => storage);
    store.write('swim-story:draft:story', 'old draft');

    storage.failWrites = true;
    assert.equal(store.clearPrefix('swim-story:draft:'), false);
    storage.failWrites = false;
    assert.deepEqual(store.read('swim-story:draft:story'), { value: null, durable: true });

    assert.equal(store.write('swim-story:draft:story', 'new draft'), true);
    assert.deepEqual(store.read('swim-story:draft:story'), { value: 'new draft', durable: true });
});

test('tab draft store clears only the requested key prefix', () => {
    const storage = new MemoryStorage();
    const safetyStates: boolean[] = [];
    const store = createTabDraftStore(() => storage, (state) => safetyStates.push(state));
    store.write('swim-story:draft:story', 'story');
    store.write('unrelated', 'keep');

    assert.equal(store.clearPrefix('swim-story:draft:'), true);
    assert.deepEqual(store.read('swim-story:draft:story'), { value: null, durable: true });
    assert.deepEqual(store.read('unrelated'), { value: 'keep', durable: true });
    assert.deepEqual(safetyStates, []);
});

test('failed cleanup never reports an unsaved volatile draft', () => {
    const storage = new MemoryStorage();
    const volatileStates: boolean[] = [];
    const store = createTabDraftStore(() => storage, (state) => volatileStates.push(state));

    storage.failWrites = true;
    assert.equal(store.remove('swim-story:draft:missing'), false);
    assert.equal(store.clearPrefix('swim-story:draft:'), true);
    assert.deepEqual(volatileStates, []);
});
