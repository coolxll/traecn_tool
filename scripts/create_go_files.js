const fs = require('fs');
const path = require('path');

const base = 'D:\\codelearn\\vscode\\reverse_proxy';

const files = {
  'internal/config/config.go': `package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config holds global proxy configuration
type Config struct {
	ListenAddr string          \`json:"listen_addr"\`
	Accounts   []AccountConfig \`json:"accounts"\`
	LogLevel   string          \`json:"log_level"\`
}

// AccountConfig holds a single Trae CN account config
type AccountConfig struct {
	Name        string \`json:"name"\`
	StoragePath string \`json:"storage_path,omitempty"\`
	Token       string \`json:"token,omitempty"\`
	Weight      int    \`json:"weight,omitempty"\`
}

// DefaultConfig returns default configuration
func DefaultConfig() *Config {
	return &Config{
		ListenAddr: ":9090",
		LogLevel:   "info",
	}
}

// LoadConfig loads configuration from file
func LoadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}
	cfg := DefaultConfig()
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}
	return cfg, nil
}

// SaveConfig saves configuration to file
func SaveConfig(cfg *Config, filePath string) error {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize config: %w", err)
	}
	return os.WriteFile(filePath, data, 0o644)
}
`,

  'internal/config/constants.go': `package config

// Trae CN backend API constants
const (
	AgentDomain    = "https://trae-api-cn.mchost.guru"
	WSDomain       = "wss://trae-ws-cn.mchost.guru/custom_model"
	AppID          = "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8"
	IDEVersion     = "3.3.37"
	IDEVersionCode = "20260212"
	IDEVersionType = "stable"
	TrafficType    = "prod"
)

// API endpoints
const (
	EndpointChatCompletion  = "/api/ide/v1/chat_completion"
	EndpointLLMRawChat      = "/api/ide/v1/llm_raw_chat"
	EndpointModelList       = "/api/ide/v1/model_list"
	EndpointGetDetailParam  = "/api/ide/v1/get_detail_param"
	EndpointAgentCreateTask = "/api/agent/v3/create_agent_task"
	EndpointAgentCommitTool = "/api/agent/v3/commit_toolcall_result"
	EndpointFeatures        = "/api/ide/v1/features"
	EndpointCodeCompletion  = "/api/ide/v1/code_completion_stream"
	EndpointEmbeddings      = "/api/ide/v1/embeddings"
	EndpointFastApply       = "/api/ide/v1/fast_apply"
	EndpointClientConfig    = "/api/ide/v1/get_client_config"
	EndpointPrivacy         = "/api/ide/v1/privacy/query"
	EndpointChatMode        = "/api/v1/commercial/chat_mode"
)

// Auth header names
const (
	HeaderIDEToken  = "X-IDE-Token"
	HeaderAuthToken = "X-Auth-Token"
	HeaderJWTToken  = "X-JWT-Token"
)

// Queue error codes
const (
	QueueExceedSize = 0xfd2 // 4050
	QueueTimeout    = 0xfd3 // 4051
)
`,

  'internal/auth/token.go': `package auth

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// TraeAuth holds Trae CN authentication info
type TraeAuth struct {
	Token            string    \`json:"token"\`
	RefreshToken     string    \`json:"refreshToken"\`
	ExpiredAt        time.Time \`json:"expiredAt"\`
	RefreshExpiredAt time.Time \`json:"refreshExpiredAt"\`
	UserID           string    \`json:"userId"\`
	Host             string    \`json:"host"\`
	UserRegion       struct {
		Region   string \`json:"region"\`
		AIRegion string \`json:"_aiRegion"\`
	} \`json:"userRegion"\`
	Account struct {
		Username   string \`json:"username"\`
		Scope      string \`json:"scope"\`
		LoginScope string \`json:"loginScope"\`
	} \`json:"account"\`
}

// IsExpired checks if token has expired
func (a *TraeAuth) IsExpired() bool {
	return time.Now().After(a.ExpiredAt)
}

// IsRefreshExpired checks if refresh token has expired
func (a *TraeAuth) IsRefreshExpired() bool {
	return time.Now().After(a.RefreshExpiredAt)
}

// TokenProvider manages multi-account tokens with round-robin
type TokenProvider struct {
	mu       sync.RWMutex
	accounts []*accountState
	index    int
}

type accountState struct {
	name        string
	storagePath string
	auth        *TraeAuth
	lastLoad    time.Time
}

// NewTokenProvider creates a new token provider
func NewTokenProvider() *TokenProvider {
	return &TokenProvider{}
}

// AddAccount adds an account by reading from storage.json
func (tp *TokenProvider) AddAccount(name, storagePath string) error {
	auth, err := LoadTokenFromStorage(storagePath)
	if err != nil {
		return fmt.Errorf("failed to load token for %s: %w", name, err)
	}
	tp.mu.Lock()
	defer tp.mu.Unlock()
	tp.accounts = append(tp.accounts, &accountState{
		name:        name,
		storagePath: storagePath,
		auth:        auth,
		lastLoad:    time.Now(),
	})
	return nil
}

// AddAccountWithToken adds an account with a direct token string
func (tp *TokenProvider) AddAccountWithToken(name, token string) {
	tp.mu.Lock()
	defer tp.mu.Unlock()
	tp.accounts = append(tp.accounts, &accountState{
		name: name,
		auth: &TraeAuth{
			Token:     token,
			ExpiredAt: time.Now().Add(365 * 24 * time.Hour),
		},
		lastLoad: time.Now(),
	})
}

// GetToken returns an available token via round-robin
func (tp *TokenProvider) GetToken() (string, string, error) {
	tp.mu.Lock()
	defer tp.mu.Unlock()

	if len(tp.accounts) == 0 {
		return "", "", fmt.Errorf("no accounts available")
	}

	for i := 0; i < len(tp.accounts); i++ {
		idx := (tp.index + i) % len(tp.accounts)
		acc := tp.accounts[idx]

		// Reload token if expired and storage path available
		if acc.auth.IsExpired() && acc.storagePath != "" {
			if newAuth, err := LoadTokenFromStorage(acc.storagePath); err == nil {
				acc.auth = newAuth
				acc.lastLoad = time.Now()
			}
		}

		if !acc.auth.IsExpired() {
			tp.index = (idx + 1) % len(tp.accounts)
			return acc.auth.Token, acc.name, nil
		}
	}

	return "", "", fmt.Errorf("all account tokens have expired")
}

// AccountInfo holds account summary info
type AccountInfo struct {
	Name      string    \`json:"name"\`
	UserID    string    \`json:"user_id"\`
	Username  string    \`json:"username"\`
	Expired   bool      \`json:"expired"\`
	ExpiresAt time.Time \`json:"expires_at"\`
}

// GetAccounts returns all account infos
func (tp *TokenProvider) GetAccounts() []AccountInfo {
	tp.mu.RLock()
	defer tp.mu.RUnlock()

	var infos []AccountInfo
	for _, acc := range tp.accounts {
		infos = append(infos, AccountInfo{
			Name:      acc.name,
			UserID:    acc.auth.UserID,
			Username:  acc.auth.Account.Username,
			Expired:   acc.auth.IsExpired(),
			ExpiresAt: acc.auth.ExpiredAt,
		})
	}
	return infos
}

// LoadTokenFromStorage reads the JWT token from Trae CN's storage.json
func LoadTokenFromStorage(storagePath string) (*TraeAuth, error) {
	data, err := os.ReadFile(storagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var storage map[string]json.RawMessage
	if err := json.Unmarshal(data, &storage); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	authKey := "iCubeAuthInfo://icube.cloudide"
	raw, ok := storage[authKey]
	if !ok {
		return nil, fmt.Errorf("auth key not found: %s", authKey)
	}

	// The value is a JSON string containing nested JSON
	var authStr string
	if err := json.Unmarshal(raw, &authStr); err != nil {
		return nil, fmt.Errorf("failed to parse auth string: %w", err)
	}

	var auth TraeAuth
	if err := json.Unmarshal([]byte(authStr), &auth); err != nil {
		return nil, fmt.Errorf("failed to parse auth object: %w", err)
	}

	return &auth, nil
}

// DefaultStoragePath returns the default Trae CN storage.json path
func DefaultStoragePath() string {
	appData := os.Getenv("APPDATA")
	return filepath.Join(appData, "Trae CN", "User", "globalStorage", "storage.json")
}
`,

  'internal/device/device.go': `package device

import (
	"crypto/sha256"
	"fmt"
	"math/rand"
	"os"
	"runtime"
	"strings"

	"github.com/zamatewi-cell/traecn_tool/internal/config"
)

// DeviceInfo simulates Trae CN client device info
type DeviceInfo struct {
	DeviceID    string
	MachineID   string
	DeviceBrand string
	DeviceCPU   string
	OSVersion   string
	DeviceType  string
}

// NewDeviceInfo generates device information
func NewDeviceInfo() *DeviceInfo {
	hostname, _ := os.Hostname()
	return &DeviceInfo{
		DeviceID:    generateDeviceID(),
		MachineID:   generateMachineID(hostname),
		DeviceBrand: hostname,
		DeviceCPU:   detectCPU(),
		OSVersion:   detectOS(),
		DeviceType:  runtime.GOOS,
	}
}

// Headers returns device-related request headers
func (d *DeviceInfo) Headers() map[string]string {
	return map[string]string{
		"x-app-id":             config.AppID,
		"x-app-version":        "default",
		"x-ide-version-code":   config.IDEVersionCode,
		"x-app-version-code":   config.IDEVersionCode,
		"x-device-brand":       d.DeviceBrand,
		"x-device-cpu":         d.DeviceCPU,
		"x-device-id":          d.DeviceID,
		"x-machine-id":         d.MachineID,
		"x-os-version":         d.OSVersion,
		"x-device-type":        d.DeviceType,
		"x-ide-version":        config.IDEVersion,
		"x-ide-version-type":   config.IDEVersionType,
		"request-traffic-type": config.TrafficType,
	}
}

func generateDeviceID() string {
	return fmt.Sprintf("%d", 1000000000000000+rand.Int63n(9000000000000000))
}

func generateMachineID(seed string) string {
	h := sha256.Sum256([]byte(seed + "trae-proxy-salt"))
	return fmt.Sprintf("%x", h)
}

func detectCPU() string {
	if runtime.GOARCH == "amd64" {
		return "Intel"
	}
	return strings.ToUpper(runtime.GOARCH)
}

func detectOS() string {
	switch runtime.GOOS {
	case "windows":
		return "Windows"
	case "darwin":
		return "macOS"
	case "linux":
		return "Linux"
	default:
		return runtime.GOOS
	}
}
`,

  'internal/models/models.go': `package models

// TraeModel defines a Trae CN model
type TraeModel struct {
	ConfigName       string \`json:"config_name"\`
	ModelName        string \`json:"model_name"\`
	DisplayName      string \`json:"display_name"\`
	Provider         string \`json:"provider"\`
	IsPreset         bool   \`json:"is_preset"\`
	UseRemoteService bool   \`json:"use_remote_service"\`
	Multimodal       bool   \`json:"multimodal"\`
}

// KnownModels lists known Trae CN models
var KnownModels = []TraeModel{
	{ConfigName: "doubao-seed-1.6", DisplayName: "Doubao-Seed-1.6", Provider: "ByteDance", IsPreset: true, UseRemoteService: true},
	{ConfigName: "doubao-1.5-pro", DisplayName: "Doubao-1.5-Pro", Provider: "ByteDance", IsPreset: true, UseRemoteService: true},
	{ConfigName: "deepseek-v3", DisplayName: "DeepSeek-V3", Provider: "DeepSeek", IsPreset: true, UseRemoteService: true},
	{ConfigName: "deepseek-r1", DisplayName: "DeepSeek-R1", Provider: "DeepSeek", IsPreset: true, UseRemoteService: true},
	{ConfigName: "glm-5", DisplayName: "GLM-5", Provider: "Zhipu", IsPreset: true, UseRemoteService: true},
	{ConfigName: "glm-4-plus", DisplayName: "GLM-4-Plus", Provider: "Zhipu", IsPreset: true, UseRemoteService: true},
	{ConfigName: "kimi-k2", DisplayName: "Kimi-K2", Provider: "Moonshot", IsPreset: true, UseRemoteService: true},
	{ConfigName: "minimax-m1", DisplayName: "MiniMax-M1", Provider: "MiniMax", IsPreset: true, UseRemoteService: true},
	{ConfigName: "qwen3-coder", DisplayName: "Qwen3-Coder", Provider: "Alibaba", IsPreset: true, UseRemoteService: true},
	{ConfigName: "qwen3", DisplayName: "Qwen3", Provider: "Alibaba", IsPreset: true, UseRemoteService: true},
	{ConfigName: "gemini-2.5-pro", DisplayName: "Gemini-2.5-Pro", Provider: "Google", IsPreset: true, UseRemoteService: true},
	{ConfigName: "claude-sonnet-4", DisplayName: "Claude-Sonnet-4", Provider: "Anthropic", IsPreset: true, UseRemoteService: true},
	{ConfigName: "gpt-4.1", DisplayName: "GPT-4.1", Provider: "OpenAI", IsPreset: true, UseRemoteService: true},
}

// FindModel finds a model by config_name
func FindModel(name string) *TraeModel {
	for i := range KnownModels {
		if KnownModels[i].ConfigName == name {
			return &KnownModels[i]
		}
	}
	return nil
}

// ModelNames returns all model config names
func ModelNames() []string {
	names := make([]string, len(KnownModels))
	for i, m := range KnownModels {
		names[i] = m.ConfigName
	}
	return names
}
`,

  'internal/sse/sse.go': `package sse

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
				evt.Data += "\\n" + data
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
	_, err := io.WriteString(w.w, "data: "+data+"\\n\\n")
	return err
}

// WriteDone writes the [DONE] event
func (w *Writer) WriteDone() error {
	_, err := io.WriteString(w.w, "data: [DONE]\\n\\n")
	return err
}
`,

  'internal/queue/queue.go': `package queue

import (
	"sync"
	"time"
)

// Status represents queue status for a model
type Status struct {
	InQueue   bool      \`json:"in_queue"\`
	Position  int       \`json:"position"\`
	Message   string    \`json:"message,omitempty"\`
	StartTime time.Time \`json:"start_time,omitempty"\`
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
`,

  'internal/proxy/proxy.go': `package proxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/zamatewi-cell/traecn_tool/internal/auth"
	"github.com/zamatewi-cell/traecn_tool/internal/config"
	"github.com/zamatewi-cell/traecn_tool/internal/device"
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
func NewTraeProxy(tokens *auth.TokenProvider, logger *slog.Logger) *TraeProxy {
	return &TraeProxy{
		client: &http.Client{Timeout: 5 * time.Minute},
		tokens: tokens,
		device: device.NewDeviceInfo(),
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
	Messages []Message \`json:"messages"\`
	Model    string    \`json:"model_name"\`
	Stream   bool      \`json:"stream"\`
}

// Message is a chat message
type Message struct {
	Role    string \`json:"role"\`
	Content string \`json:"content"\`
}

// ChatCompletion sends a chat request to Trae CN backend
func (p *TraeProxy) ChatCompletion(req *ChatCompletionRequest, w http.ResponseWriter) error {
	token, accountName, err := p.tokens.GetToken()
	if err != nil {
		return fmt.Errorf("failed to get token: %w", err)
	}
	p.logger.Info("using account", "account", accountName, "model", req.Model)

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	endpoint := config.AgentDomain + config.EndpointChatCompletion
	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	p.setHeaders(httpReq, token)

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
	httpReq, err := http.NewRequest("POST", endpoint, bytes.NewReader([]byte("{}")))
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
	req.Header.Set(config.HeaderIDEToken, token)
	req.Header.Set("X-Request-ID", uuid.New().String())
	req.Header.Set("X-Trae-Request-ID", uuid.New().String())

	for k, v := range p.device.Headers() {
		req.Header.Set(k, v)
	}
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
`,

  'internal/openai/server.go': `package openai

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/zamatewi-cell/traecn_tool/internal/models"
	"github.com/zamatewi-cell/traecn_tool/internal/proxy"
)

// Server is the OpenAI-compatible API server
type Server struct {
	proxy  *proxy.TraeProxy
	logger *slog.Logger
	mux    *http.ServeMux
}

// NewServer creates an OpenAI API server
func NewServer(p *proxy.TraeProxy, logger *slog.Logger) *Server {
	s := &Server{
		proxy:  p,
		logger: logger,
		mux:    http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

func (s *Server) registerRoutes() {
	s.mux.HandleFunc("GET /v1/models", s.handleModels)
	s.mux.HandleFunc("POST /v1/chat/completions", s.handleChatCompletions)
	s.mux.HandleFunc("GET /v1/queue/status", s.handleQueueStatus)
	s.mux.HandleFunc("GET /health", s.handleHealth)
	s.mux.HandleFunc("GET /", s.handleRoot)
}

// ServeHTTP implements http.Handler
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	s.mux.ServeHTTP(w, r)
}

func (s *Server) handleModels(w http.ResponseWriter, r *http.Request) {
	type modelObj struct {
		ID      string \`json:"id"\`
		Object  string \`json:"object"\`
		Created int64  \`json:"created"\`
		OwnedBy string \`json:"owned_by"\`
	}

	var modelList []modelObj
	for _, m := range models.KnownModels {
		modelList = append(modelList, modelObj{
			ID:      m.ConfigName,
			Object:  "model",
			Created: time.Now().Unix(),
			OwnedBy: m.Provider,
		})
	}

	resp := map[string]interface{}{
		"object": "list",
		"data":   modelList,
	}
	writeJSON(w, http.StatusOK, resp)
}

// ChatCompletionRequest is the OpenAI-format chat request
type ChatCompletionRequest struct {
	Model       string        \`json:"model"\`
	Messages    []ChatMessage \`json:"messages"\`
	Stream      bool          \`json:"stream"\`
	Temperature *float64      \`json:"temperature,omitempty"\`
	MaxTokens   *int          \`json:"max_tokens,omitempty"\`
}

// ChatMessage is an OpenAI-format message
type ChatMessage struct {
	Role    string \`json:"role"\`
	Content string \`json:"content"\`
}

func (s *Server) handleChatCompletions(w http.ResponseWriter, r *http.Request) {
	var req ChatCompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}

	if req.Model == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "model is required")
		return
	}
	if len(req.Messages) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "messages is required")
		return
	}

	s.logger.Info("chat request", "model", req.Model, "stream", req.Stream, "messages", len(req.Messages))

	traeMessages := make([]proxy.Message, len(req.Messages))
	for i, m := range req.Messages {
		traeMessages[i] = proxy.Message{Role: m.Role, Content: m.Content}
	}

	traeReq := &proxy.ChatCompletionRequest{
		Messages: traeMessages,
		Model:    req.Model,
		Stream:   req.Stream,
	}

	if err := s.proxy.ChatCompletion(traeReq, w); err != nil {
		s.logger.Error("chat request failed", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}

func (s *Server) handleQueueStatus(w http.ResponseWriter, r *http.Request) {
	model := r.URL.Query().Get("model")
	monitor := s.proxy.GetQueueMonitor()

	if model != "" {
		writeJSON(w, http.StatusOK, monitor.GetQueueStatus(model))
	} else {
		writeJSON(w, http.StatusOK, monitor.GetAllStatus())
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": "0.1.0"})
}

func (s *Server) handleRoot(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"name":    "trae-proxy",
		"version": "0.1.0",
		"docs":    "https://github.com/zamatewi-cell/traecn_tool",
	})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, errType string, message string) {
	writeJSON(w, status, map[string]interface{}{
		"error": map[string]string{"type": errType, "message": message},
	})
}

// ListenAndServe starts the HTTP server
func (s *Server) ListenAndServe(addr string) error {
	s.logger.Info("starting OpenAI-compatible API server", "addr", addr)
	s.logger.Info(fmt.Sprintf("API: http://localhost%s/v1/chat/completions", addr))
	s.logger.Info(fmt.Sprintf("Models: http://localhost%s/v1/models", addr))
	s.logger.Info(fmt.Sprintf("Queue: http://localhost%s/v1/queue/status", addr))
	return http.ListenAndServe(addr, s)
}
`,

  'cmd/trae-proxy/main.go': `package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"

	"github.com/zamatewi-cell/traecn_tool/internal/auth"
	"github.com/zamatewi-cell/traecn_tool/internal/config"
	"github.com/zamatewi-cell/traecn_tool/internal/openai"
	"github.com/zamatewi-cell/traecn_tool/internal/proxy"
)

var version = "0.1.0"

func main() {
	configPath := flag.String("config", "config.json", "config file path")
	listen := flag.String("listen", ":9090", "listen address")
	logLevel := flag.String("log-level", "info", "log level (debug/info/warn/error)")
	showVersion := flag.Bool("version", false, "show version")
	flag.Parse()

	if *showVersion {
		fmt.Printf("trae-proxy v%s\\n", version)
		os.Exit(0)
	}

	// Setup logger
	var level slog.Level
	switch *logLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: level}))

	// Load config
	var cfg *config.Config
	if _, err := os.Stat(*configPath); err == nil {
		cfg, err = config.LoadConfig(*configPath)
		if err != nil {
			logger.Error("failed to load config", "error", err)
			os.Exit(1)
		}
		logger.Info("loaded config", "path", *configPath)
	} else {
		cfg = config.DefaultConfig()
		logger.Info("using default config (auto-detecting Trae CN token)")
	}

	if *listen != ":9090" {
		cfg.ListenAddr = *listen
	}

	// Initialize token provider
	tp := auth.NewTokenProvider()

	if len(cfg.Accounts) > 0 {
		for _, acc := range cfg.Accounts {
			if acc.Token != "" {
				tp.AddAccountWithToken(acc.Name, acc.Token)
				logger.Info("added account (direct token)", "name", acc.Name)
			} else {
				storagePath := acc.StoragePath
				if storagePath == "" {
					storagePath = auth.DefaultStoragePath()
				}
				if err := tp.AddAccount(acc.Name, storagePath); err != nil {
					logger.Warn("failed to add account", "name", acc.Name, "error", err)
				} else {
					logger.Info("added account", "name", acc.Name)
				}
			}
		}
	} else {
		storagePath := auth.DefaultStoragePath()
		if err := tp.AddAccount("default", storagePath); err != nil {
			logger.Error("failed to auto-detect Trae CN token", "path", storagePath, "error", err)
			logger.Info("you can create config.json to manually configure tokens")
			os.Exit(1)
		}
		logger.Info("auto-detected Trae CN token")
	}

	// Start proxy
	traeProxy := proxy.NewTraeProxy(tp, logger)
	server := openai.NewServer(traeProxy, logger)

	logger.Info("====================================")
	logger.Info("  trae-proxy v" + version)
	logger.Info("  Trae CN -> OpenAI Compatible API")
	logger.Info("====================================")

	if err := server.ListenAndServe(cfg.ListenAddr); err != nil {
		logger.Error("server failed", "error", err)
		os.Exit(1)
	}
}
`,
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(base, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created: ' + relPath);
}
console.log('All files created successfully');
