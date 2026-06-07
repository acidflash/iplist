package main

import (
	"encoding/json"
	"os"
	"strings"
)

// defaultJWTSecret is the fallback used when nothing is configured.
const defaultJWTSecret = "change-me-in-production"

// insecureJWTSecrets are the placeholder values shipped throughout the repo
// (config default, .env.example, docker-compose). The server refuses to start
// with any of them, since a publicly-known secret lets anyone forge admin
// tokens.
var insecureJWTSecrets = map[string]bool{
	"":                                  true,
	"change-me-in-production":           true,
	"change-me-to-a-long-random-string": true,
}

type Config struct {
	DBPath      string   `json:"db_path"`
	JWTSecret   string   `json:"jwt_secret"`
	Port        string   `json:"port"`
	CORSOrigins []string `json:"cors_origins"`
}

var appCfg = &Config{}

// InsecureJWTSecret reports whether the configured secret is empty or the
// well-known placeholder, i.e. unsafe for any non-development deployment.
func (c *Config) InsecureJWTSecret() bool {
	return insecureJWTSecrets[c.JWTSecret]
}

func LoadConfig(path string) error {
	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil && !os.IsNotExist(err) {
			return err
		}
		if err == nil {
			if err := json.Unmarshal(data, appCfg); err != nil {
				return err
			}
		}
	}

	// Environment variables override config file
	if v := os.Getenv("DB_PATH"); v != "" {
		appCfg.DBPath = v
	}
	if v := os.Getenv("JWT_SECRET"); v != "" {
		appCfg.JWTSecret = v
	}
	if v := os.Getenv("PORT"); v != "" {
		appCfg.Port = v
	}
	if v := os.Getenv("CORS_ORIGINS"); v != "" {
		appCfg.CORSOrigins = splitAndTrim(v)
	}

	// Defaults
	if appCfg.DBPath == "" {
		appCfg.DBPath = "iplist.db"
	}
	if appCfg.JWTSecret == "" {
		appCfg.JWTSecret = defaultJWTSecret
	}
	if appCfg.Port == "" {
		appCfg.Port = "8080"
	}
	if len(appCfg.CORSOrigins) == 0 {
		appCfg.CORSOrigins = []string{"*"}
	}

	return nil
}

func splitAndTrim(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
