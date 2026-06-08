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

// KnownModels lists known Trae CN models (updated to match current Trae CN v3.3.55)
// Reference: CLIProxyAPI resolver and trae-reverse findings
var KnownModels = []TraeModel{
	// V1 raw chat models (llm_raw_chat)
	{ConfigName: "seed_m8", ModelName: "seed_m8", DisplayName: "Doubao-1.5-Pro", Provider: "ByteDance", IsPreset: true, UseRemoteService: true},
	{ConfigName: "deepseek-R1", ModelName: "deepseek-R1", DisplayName: "DeepSeek-R1", Provider: "DeepSeek", IsPreset: true, UseRemoteService: true},
	{ConfigName: "deepseek-V3", ModelName: "deepseek-V3", DisplayName: "DeepSeek-V3", Provider: "DeepSeek", IsPreset: true, UseRemoteService: true},
	{ConfigName: "deepseek-V3-0324", ModelName: "deepseek-V3-0324", DisplayName: "DeepSeek-V3-0324", Provider: "DeepSeek", IsPreset: true, UseRemoteService: true},
	// V3 agent models (create_agent_task)
	{ConfigName: "DeepSeek-V4-Pro", ModelName: "DeepSeek-V4-Pro", DisplayName: "DeepSeek-V4-Pro", Provider: "DeepSeek", IsPreset: true, UseRemoteService: true},
	{ConfigName: "DeepSeek-V4-Flash", ModelName: "DeepSeek-V4-Flash", DisplayName: "DeepSeek-V4-Flash", Provider: "DeepSeek", IsPreset: true, UseRemoteService: true},
	{ConfigName: "glm-5", ModelName: "glm-5", DisplayName: "GLM-5", Provider: "Zhipu", IsPreset: true, UseRemoteService: true},
	{ConfigName: "glm-5.1", ModelName: "glm-5.1", DisplayName: "GLM-5.1", Provider: "Zhipu", IsPreset: true, UseRemoteService: true},
	{ConfigName: "glm-5v-turbo", ModelName: "glm-5v-turbo", DisplayName: "GLM-5V-Turbo", Provider: "Zhipu", IsPreset: true, UseRemoteService: true, Multimodal: true},
	{ConfigName: "glm-4.7", ModelName: "glm-4.7", DisplayName: "GLM-4.7", Provider: "Zhipu", IsPreset: true, UseRemoteService: true},
	{ConfigName: "glm-4.6", ModelName: "glm-4.6", DisplayName: "GLM-4.6", Provider: "Zhipu", IsPreset: true, UseRemoteService: true},
	{ConfigName: "kimi-k2.6", ModelName: "kimi-k2.6", DisplayName: "Kimi-K2.6", Provider: "Moonshot", IsPreset: true, UseRemoteService: true},
	{ConfigName: "kimi-k2.5", ModelName: "kimi-k2.5", DisplayName: "Kimi-K2.5", Provider: "Moonshot", IsPreset: true, UseRemoteService: true},
	{ConfigName: "kimi-k2", ModelName: "kimi-k2", DisplayName: "Kimi-K2", Provider: "Moonshot", IsPreset: true, UseRemoteService: true},
	{ConfigName: "qwen-3.6-plus", ModelName: "qwen-3.6-plus__v2", DisplayName: "Qwen-3.6-Plus", Provider: "Alibaba", IsPreset: true, UseRemoteService: true},
	{ConfigName: "qwen-3.5", ModelName: "qwen-3.5", DisplayName: "Qwen-3.5-Plus", Provider: "Alibaba", IsPreset: true, UseRemoteService: true},
	{ConfigName: "qwen3-coder", ModelName: "qwen3-coder__v2", DisplayName: "Qwen3-Coder", Provider: "Alibaba", IsPreset: true, UseRemoteService: true},
	{ConfigName: "Doubao-Seed-2.0-Code", ModelName: "Doubao-Seed-2.0-Code__v2", DisplayName: "Doubao-Seed-2.0-Code", Provider: "ByteDance", IsPreset: true, UseRemoteService: true},
	{ConfigName: "doubao_1_8", ModelName: "doubao_1_8", DisplayName: "Doubao-Seed-1.8", Provider: "ByteDance", IsPreset: true, UseRemoteService: true},
	{ConfigName: "Doubao_1_6", ModelName: "Doubao_1_6", DisplayName: "Doubao-Seed-1.6", Provider: "ByteDance", IsPreset: true, UseRemoteService: true},
	{ConfigName: "doubao-for-auto", ModelName: "doubao-for-auto", DisplayName: "Doubao-Auto", Provider: "ByteDance", IsPreset: true, UseRemoteService: true},
	{ConfigName: "minimax-m2.7", ModelName: "minimax-m2.7", DisplayName: "MiniMax-M2.7", Provider: "MiniMax", IsPreset: true, UseRemoteService: true},
	{ConfigName: "minimax-m2.5", ModelName: "minimax-m2.5", DisplayName: "MiniMax-M2.5", Provider: "MiniMax", IsPreset: true, UseRemoteService: true},
	{ConfigName: "minimax-m2.1", ModelName: "minimax-m2.1", DisplayName: "MiniMax-M2.1", Provider: "MiniMax", IsPreset: true, UseRemoteService: true},
	{ConfigName: "minimax-m2", ModelName: "minimax-m2", DisplayName: "MiniMax-M2", Provider: "MiniMax", IsPreset: true, UseRemoteService: true},
	// V2 special model (llm_raw_chat v2, for title generation)
	{ConfigName: "no_thinking_model", ModelName: "no_thinking_model", DisplayName: "No-Thinking-Model", Provider: "Trae", IsPreset: true, UseRemoteService: true},
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
