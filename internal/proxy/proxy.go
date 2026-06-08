package proxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/zamatewi-cell/traecn_tool/internal/auth"
	"github.com/zamatewi-cell/traecn_tool/internal/config"
	"github.com/zamatewi-cell/traecn_tool/internal/device"
	"github.com/zamatewi-cell/traecn_tool/internal/encoding"
	"github.com/zamatewi-cell/traecn_tool/internal/queue"
	"github.com/zamatewi-cell/traecn_tool/internal/sse"
)

// TraeProxy is the core proxy client
type TraeProxy struct {
	client *http.Client
	tokens *auth.TokenProvider
	device *device.DeviceInfo
	queue  *queue.Monitor
	logger *slog.Logger
}

// NewTraeProxy creates a new proxy instance
func NewTraeProxy(tokens *auth.TokenProvider, cfg *config.Config, configPath string, logger *slog.Logger) *TraeProxy {
	return &TraeProxy{
		client: &http.Client{Timeout: 5 * time.Minute},
		tokens: tokens,
		device: device.NewDeviceInfo(cfg, configPath),
		queue:  queue.NewMonitor(),
		logger: logger,
	}
}

// GetQueueMonitor returns the queue monitor
func (p *TraeProxy) GetQueueMonitor() *queue.Monitor {
	return p.queue
}

// ChatCompletionRequest is the Trae chat request format
type ChatCompletionRequest struct {
	Messages []Message `json:"messages"`
	Model    string    `json:"model_name"`
	Stream   bool      `json:"stream"`
}

// Message is a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatCompletion sends a chat request to Trae CN backend
func (p *TraeProxy) ChatCompletion(req *ChatCompletionRequest, w http.ResponseWriter) error {
	token, accountName, err := p.tokens.GetToken()
	if err != nil {
		return fmt.Errorf("failed to get token: %w", err)
	}
	p.logger.Info("using account", "account", accountName, "model", req.Model)

	// Build inner payload (messages array)
	innerPayload := buildRawChatMessages(req.Messages)
	innerBytes, err := json.Marshal(innerPayload)
	if err != nil {
		return fmt.Errorf("failed to marshal inner payload: %w", err)
	}

	// Encrypt inner payload
	encrypted, err := encoding.EncryptMessage(innerBytes)
	if err != nil {
		return fmt.Errorf("failed to encrypt payload: %w", err)
	}

	// Build outer envelope: V1 format
	envelope := map[string]any{
		"model_name": req.Model,
		"message":    encrypted.Message,
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		return fmt.Errorf("failed to marshal envelope: %w", err)
	}

	sessionID := strings.ReplaceAll(uuid.New().String(), "-", "")[:24]

	endpoint := config.AgentDomain + config.EndpointChatCompletion
	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	p.setHeaders(httpReq, token)
	httpReq.Header.Set("X-Ide-Session-Id", sessionID)
	httpReq.Header.Set("X-Request-Pin", encrypted.RequestPin)
	httpReq.Header.Set("X-Requested-At", strconv.FormatInt(encrypted.RequestAt, 10))
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Cache-Control", "no-cache")

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	if req.Stream {
		return p.streamResponse(resp.Body, w, req.Model)
	}
	_, err = io.Copy(w, resp.Body)
	return err
}

// FetchModels fetches model list from Trae backend
func (p *TraeProxy) FetchModels() (json.RawMessage, error) {
	token, _, err := p.tokens.GetToken()
	if err != nil {
		return nil, err
	}

	endpoint := config.AgentDomain + config.EndpointModelList
	httpReq, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	p.setHeaders(httpReq, token)

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return io.ReadAll(resp.Body)
}

func (p *TraeProxy) setHeaders(req *http.Request, token string) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", config.AuthHeaderFormat+" "+token)

	for k, v := range p.device.Headers() {
		req.Header.Set(k, v)
	}
}

func buildRawChatMessages(messages []Message) []map[string]any {
	result := make([]map[string]any, 0, len(messages))
	for _, msg := range messages {
		result = append(result, map[string]any{
			"role": msg.Role,
			"content": []map[string]string{
				{
					"type": "text",
					"text": msg.Content,
				},
			},
		})
	}
	return result
}

func (p *TraeProxy) streamResponse(body io.Reader, w http.ResponseWriter, model string) error {
	flusher, ok := w.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming not supported")
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	reader := sse.NewReader(body)
	writer := sse.NewWriter(w)

	for {
		evt, err := reader.ReadEvent()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		p.detectQueueStatus(evt, model)

		if err := writer.WriteEvent(evt.Data); err != nil {
			return err
		}
		flusher.Flush()
	}

	p.queue.SetQueueStatus(model, 0, "")
	return writer.WriteDone()
}

func (p *TraeProxy) detectQueueStatus(evt *sse.Event, model string) {
	if evt.Data == "" {
		return
	}
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(evt.Data), &data); err != nil {
		return
	}
	if pos, ok := data["queue_position"]; ok {
		if posNum, ok := pos.(float64); ok && posNum > 0 {
			msg := fmt.Sprintf("Queue position: %d", int(posNum))
			p.queue.SetQueueStatus(model, int(posNum), msg)
			p.logger.Info("queue status", "model", model, "position", int(posNum))
		}
	}
}