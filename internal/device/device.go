package device

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
