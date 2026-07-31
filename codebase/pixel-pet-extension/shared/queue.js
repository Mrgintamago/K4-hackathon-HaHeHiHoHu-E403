export class BoundedQueue {
  constructor(limit = 50) {
    this.limit = limit;
    this.items = [];
  }
  push(item) {
    this.items.push(item);
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
  }
  shift() { return this.items.shift(); }
  get length() { return this.items.length; }
}

export function rememberId(ids, id, limit = 500) {
  if (ids.has(id)) return false;
  ids.add(id);
  while (ids.size > limit) ids.delete(ids.values().next().value);
  return true;
}
