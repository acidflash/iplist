package main

import (
	"flag"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	seedFlag := flag.Bool("seed", false, "Seed database with test data (only if empty)")
	configPath := flag.String("config", "config.json", "Path to JSON config file")
	flag.Parse()

	if err := LoadConfig(*configPath); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := InitDB(appCfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	if err := seedDefaultUsers(db); err != nil {
		log.Fatalf("Failed to seed default users: %v", err)
	}

	if *seedFlag {
		if dbIsEmpty(db) {
			if err := SeedDB(db); err != nil {
				log.Fatalf("Seed failed: %v", err)
			}
		} else {
			log.Println("Database already has data, skipping seed")
		}
	}

	prefixRepo := NewPrefixRepo(db)
	vlanRepo := NewVLANRepo(db)
	addressRepo := NewAddressRepo(db)
	userRepo := NewUserRepo(db)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
	}))

	r.Route("/api/v1", func(r chi.Router) {
		// Public
		r.Post("/auth/login", LoginHandler(userRepo))

		// All authenticated users
		r.Group(func(r chi.Router) {
			r.Use(RequireAuth)

			r.Get("/auth/me", MeHandler())

			r.Get("/stats", func(w http.ResponseWriter, req *http.Request) {
				totalPrefixes, _ := prefixRepo.TotalCount()
				totalVLANs, _ := vlanRepo.TotalCount()
				totalAddresses, _ := addressRepo.TotalCount()

				var totalIPs, usedIPs int64
				prefixes, err := prefixRepo.List()
				if err == nil {
					for _, p := range prefixes {
						if p.ParentID == nil {
							totalIPs += p.TotalIPs
							usedIPs += p.UsedIPs
						}
					}
				}

				var utilization float64
				if totalIPs > 0 {
					utilization = float64(usedIPs) / float64(totalIPs) * 100
				}

				respondJSON(w, http.StatusOK, Stats{
					TotalPrefixes:  totalPrefixes,
					TotalVLANs:     totalVLANs,
					TotalAddresses: totalAddresses,
					Utilization:    utilization,
				})
			})

			r.Get("/prefixes", ListPrefixes(prefixRepo))
			r.Get("/prefixes/{id}", GetPrefix(prefixRepo))
			r.Get("/prefixes/{id}/subnets", GetSubnets(prefixRepo))
			r.Get("/vlans", ListVLANs(vlanRepo))
			r.Get("/vlans/{id}", GetVLAN(vlanRepo, prefixRepo))
			r.Get("/addresses", ListAddresses(addressRepo))
			r.Get("/addresses/{id}", GetAddress(addressRepo))

			// Admin only — write operations
			r.Group(func(r chi.Router) {
				r.Use(RequireAdmin)

				r.Post("/prefixes", CreatePrefix(prefixRepo))
				r.Post("/prefixes/import", ImportPrefixes(prefixRepo, vlanRepo))
				r.Put("/prefixes/{id}", UpdatePrefix(prefixRepo))
				r.Delete("/prefixes/{id}", DeletePrefix(prefixRepo))

				r.Post("/vlans", CreateVLAN(vlanRepo))
				r.Post("/vlans/import", ImportVLANs(vlanRepo))
				r.Put("/vlans/{id}", UpdateVLAN(vlanRepo))
				r.Delete("/vlans/{id}", DeleteVLAN(vlanRepo))

				r.Post("/addresses", CreateAddress(addressRepo, prefixRepo))
				r.Post("/addresses/import", ImportAddresses(addressRepo))
				r.Put("/addresses/{id}", UpdateAddress(addressRepo))
				r.Delete("/addresses/{id}", DeleteAddress(addressRepo))

				r.Get("/users", ListUsers(userRepo))
				r.Post("/users", CreateUser(userRepo))
				r.Put("/users/{id}", UpdateUser(userRepo))
				r.Delete("/users/{id}", DeleteUser(userRepo))
			})
		})
	})

	log.Printf("Server starting on :%s", appCfg.Port)
	if err := http.ListenAndServe(":"+appCfg.Port, r); err != nil {
		log.Fatal(err)
	}
}
