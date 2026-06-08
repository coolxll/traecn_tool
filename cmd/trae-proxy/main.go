package main

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
		fmt.Printf("trae-proxy v%s\n", version)
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
	traeProxy := proxy.NewTraeProxy(tp, cfg, *configPath, logger)
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
