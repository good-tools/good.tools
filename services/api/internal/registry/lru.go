package registry

import (
	"container/list"
	"sync"
)

// lru is a cost-bounded LRU. The most recently added item is never evicted, so a
// single item larger than the cap still works (it just evicts everything else).
type lru[V any] struct {
	mu      sync.Mutex
	max     int64
	used    int64
	ll      *list.List
	items   map[string]*list.Element
	onEvict func(key string, v V)
}

type lruItem[V any] struct {
	key  string
	v    V
	cost int64
}

func newLRU[V any](maxCost int64, onEvict func(string, V)) *lru[V] {
	return &lru[V]{max: maxCost, ll: list.New(), items: map[string]*list.Element{}, onEvict: onEvict}
}

func (c *lru[V]) get(key string) (V, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.items[key]; ok {
		c.ll.MoveToFront(e)
		return e.Value.(*lruItem[V]).v, true
	}
	var zero V
	return zero, false
}

func (c *lru[V]) add(key string, v V, cost int64) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.items[key]; ok {
		it := e.Value.(*lruItem[V])
		c.used += cost - it.cost
		it.v, it.cost = v, cost
		c.ll.MoveToFront(e)
	} else {
		c.items[key] = c.ll.PushFront(&lruItem[V]{key, v, cost})
		c.used += cost
	}
	for c.used > c.max && c.ll.Len() > 1 {
		it := c.ll.Remove(c.ll.Back()).(*lruItem[V])
		delete(c.items, it.key)
		c.used -= it.cost
		if c.onEvict != nil {
			c.onEvict(it.key, it.v)
		}
	}
}
