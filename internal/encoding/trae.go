package encoding

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

const traeKeyHex = "6195f24ca4d430f8a4833de7db8dac37d148a084e7464a351ffa68585c16b955"

var traeBaseKey []byte

func init() {
	key, err := hex.DecodeString(traeKeyHex)
	if err != nil {
		panic(fmt.Sprintf("failed to decode trae key hex: %v", err))
	}
	if len(key) != 32 {
		panic(fmt.Sprintf("trae key must be 32 bytes, got %d", len(key)))
	}
	traeBaseKey = key
}

// EncryptedMessage holds the result of encrypting a message
type EncryptedMessage struct {
	Message    string // base64-encoded nonce+ciphertext
	RequestPin string // hex-encoded 8-byte pin
	RequestAt  int64  // Unix timestamp used as AAD
}

// EncryptMessage encrypts plaintext using AES-256-GCM with per-request key derivation
func EncryptMessage(plaintext []byte) (*EncryptedMessage, error) {
	return EncryptMessageAt(plaintext, time.Now().Unix())
}

// EncryptMessageAt encrypts plaintext with a specific timestamp for AAD
func EncryptMessageAt(plaintext []byte, requestAt int64) (*EncryptedMessage, error) {
	// Generate random 8-byte pin
	pin := make([]byte, 8)
	if _, err := rand.Read(pin); err != nil {
		return nil, fmt.Errorf("generate pin: %w", err)
	}

	// Derive effective key: XOR first 8 bytes of base key with pin
	effectiveKey := make([]byte, 32)
	copy(effectiveKey, traeBaseKey)
	for i := 0; i < 8; i++ {
		effectiveKey[i] ^= pin[i]
	}

	// Create AES-256-GCM cipher
	block, err := aes.NewCipher(effectiveKey)
	if err != nil {
		return nil, fmt.Errorf("create aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("create gcm: %w", err)
	}

	// Generate random nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("generate nonce: %w", err)
	}

	// Use timestamp string as AAD
	aad := []byte(fmt.Sprintf("%d", requestAt))

	// Encrypt: nonce || ciphertext + tag
	ciphertext := gcm.Seal(nonce, nonce, plaintext, aad)

	// Add line breaks every 76 chars to prevent bufio.Scanner "token too long"
	// errors on the server side for large payloads (>64KB)
	encoded := addLineBreaks(base64.StdEncoding.EncodeToString(ciphertext), 76)

	return &EncryptedMessage{
		Message:    encoded,
		RequestPin: hex.EncodeToString(pin),
		RequestAt:  requestAt,
	}, nil
}

// addLineBreaks inserts a newline character every lineLen characters.
// This prevents the bufio.Scanner on the API server from treating
// the entire base64 string as a single token exceeding 64KB.
func addLineBreaks(s string, lineLen int) string {
	if len(s) <= lineLen {
		return s
	}
	var buf strings.Builder
	buf.Grow(len(s) + len(s)/lineLen)
	for i := 0; i < len(s); i += lineLen {
		end := i + lineLen
		if end > len(s) {
			end = len(s)
		}
		buf.WriteString(s[i:end])
		if end < len(s) {
			buf.WriteByte('\n')
		}
	}
	return buf.String()
}