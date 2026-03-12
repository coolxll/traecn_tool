package sse

import (
	"bufio"
	"io"
	"strings"
)

// Event represents an SSE event
type Event struct {
	ID    string
	Event string
	Data  string
}

// Reader reads SSE events from a stream
type Reader struct {
	scanner *bufio.Scanner
}

// NewReader creates a new SSE reader
func NewReader(r io.Reader) *Reader {
	return &Reader{scanner: bufio.NewScanner(r)}
}

// ReadEvent reads the next SSE event
func (r *Reader) ReadEvent() (*Event, error) {
	var evt Event
	hasData := false

	for r.scanner.Scan() {
		line := r.scanner.Text()

		if line == "" {
			if hasData {
				return &evt, nil
			}
			continue
		}

		if strings.HasPrefix(line, "data:") {
			data := strings.TrimPrefix(line, "data:")
			data = strings.TrimPrefix(data, " ")
			if hasData {
				evt.Data += "\n" + data
			} else {
				evt.Data = data
				hasData = true
			}
		} else if strings.HasPrefix(line, "event:") {
			evt.Event = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "id:") {
			evt.ID = strings.TrimSpace(strings.TrimPrefix(line, "id:"))
		}
	}

	if err := r.scanner.Err(); err != nil {
		return nil, err
	}
	if hasData {
		return &evt, nil
	}
	return nil, io.EOF
}

// Writer writes SSE events to a stream
type Writer struct {
	w io.Writer
}

// NewWriter creates a new SSE writer
func NewWriter(w io.Writer) *Writer {
	return &Writer{w: w}
}

// WriteEvent writes an SSE data event
func (w *Writer) WriteEvent(data string) error {
	_, err := io.WriteString(w.w, "data: "+data+"\n\n")
	return err
}

// WriteDone writes the [DONE] event
func (w *Writer) WriteDone() error {
	_, err := io.WriteString(w.w, "data: [DONE]\n\n")
	return err
}
