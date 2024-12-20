import { invariant } from "./invariant.ts";

// @internal
export class WeakRefMap<K extends WeakKey, V extends object> {
  private map = new WeakMap<K, WeakRef<V>>();

  get(key: K) {
    const ref = this.map.get(key);
    if (ref) {
      const value = ref.deref();
      if (value) {
        return value;
      }
      this.map.delete(key);
    }
  }

  set(key: K, value: V) {
    invariant(!this.get(key));
    this.map.set(key, new WeakRef(value));
    return () => {
      this.map.delete(key);
    };
  }
}
