package main

import (
	"encoding/json"
	"os"
)

type Config struct {
	DBPath    string `json:"db_path"`
	JWTSecret string `json:"jwt_secret"`
	Port      string `json:"port"`
}

var appCfg = &Config{}

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

	// Defaults
	if appCfg.DBPath == "" {
		appCfg.DBPath = "iplist.db"
	}
	if appCfg.JWTSecret == "" {
		appCfg.JWTSecret = "change-me-in-production"
	}
	if appCfg.Port == "" {
		appCfg.Port = "8080"
	}

	return nil
}
