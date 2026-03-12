package models

// TraeModel defines a Trae CN model
type TraeModel struct {
	ConfigName       string `json:"config_name"`
	ModelName        string `json:"model_name"`
	DisplayName      string `json:"display_name"`
	Provider         string `json:"provider"`
	IsPreset         bool   `json:"is_preset"`
	UseRemoteService bool   `json:"use_remote_service"`
	Multimodal       bool   `json:"multimodal"`
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
