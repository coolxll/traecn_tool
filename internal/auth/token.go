package auth

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
	Token            string    `json:"token"`
	RefreshToken     string    `json:"refreshToken"`
	ExpiredAt        time.Time `json:"expiredAt"`
	RefreshExpiredAt time.Time `json:"refreshExpiredAt"`
	UserID           string    `json:"userId"`
	Host             string    `json:"host"`
	UserRegion       struct {
		Region   string `json:"region"`
		AIRegion string `json:"_aiRegion"`
	} `json:"userRegion"`
	Account struct {
		Username   string `json:"username"`
		Scope      string `json:"scope"`
		LoginScope string `json:"loginScope"`
	} `json:"account"`
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
	Name      string    `json:"name"`
	UserID    string    `json:"user_id"`
	Username  string    `json:"username"`
	Expired   bool      `json:"expired"`
	ExpiresAt time.Time `json:"expires_at"`
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
