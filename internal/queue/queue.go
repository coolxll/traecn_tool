package queue

import (
	"sync"
	"time"
)

// Status represents queue status for a model
type Status struct {
	InQueue   bool      `json:"in_queue"`
	Position  int       `json:"position"`
	Message   string    `json:"message,omitempty"`
	StartTime time.Time `json:"start_time,omitempty"`
}

// Monitor tracks queue status for models
type Monitor struct {
	mu     sync.RWMutex
	queues map[string]*Status
}

// NewMonitor creates a queue monitor
func NewMonitor() *Monitor {
	return &Monitor{
		queues: make(map[string]*Status),
	}
}

// SetQueueStatus sets queue status for a model
func (m *Monitor) SetQueueStatus(model string, position int, message string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if position > 0 {
		m.queues[model] = &Status{
			InQueue:   true,
			Position:  position,
			Message:   message,
			StartTime: time.Now(),
		}
	} else {
		delete(m.queues, model)
	}
}

// GetQueueStatus gets queue status for a model
func (m *Monitor) GetQueueStatus(model string) *Status {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if s, ok := m.queues[model]; ok {
		return s
	}
	return &Status{InQueue: false}
}

// GetAllStatus gets all queue statuses
func (m *Monitor) GetAllStatus() map[string]*Status {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]*Status, len(m.queues))
	for k, v := range m.queues {
		result[k] = v
	}
	return result
}
