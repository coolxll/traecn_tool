package openai

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
		ID      string `json:"id"`
		Object  string `json:"object"`
		Created int64  `json:"created"`
		OwnedBy string `json:"owned_by"`
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
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Stream      bool          `json:"stream"`
	Temperature *float64      `json:"temperature,omitempty"`
	MaxTokens   *int          `json:"max_tokens,omitempty"`
}

// ChatMessage is an OpenAI-format message
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
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
