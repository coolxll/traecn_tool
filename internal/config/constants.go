package config

// Trae CN backend API constants
const (
	AgentDomain    = "https://trae-api-cn.mchost.guru"
	WSDomain       = "wss://trae-ws-cn.mchost.guru/custom_model"
	AppID            = "6eefa01c-1036-4c7e-9ca5-d891f63bfcd8"
	IDEVersion       = "3.3.55"
	IDEVersionCode   = "20260508"
	AppVersionCode   = "20260401"
	IDEVersionType   = "stable"
	TrafficType      = "prod"
)

// API endpoints
const (
	EndpointChatCompletion  = "/api/ide/v1/llm_raw_chat"
	EndpointLLMRawChatV1    = "/api/ide/v1/llm_raw_chat"
	EndpointLLMRawChatV2    = "/api/ide/v2/llm_raw_chat"
	EndpointModelList       = "/api/ide/v1/model_list?type=llm_raw_chat"
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

// Auth header format
const (
	AuthHeaderFormat = "Cloud-IDE-JWT" // Authorization: Cloud-IDE-JWT <jwt_token>
)

// Queue error codes
const (
	QueueExceedSize = 0xfd2 // 4050
	QueueTimeout    = 0xfd3 // 4051
)
