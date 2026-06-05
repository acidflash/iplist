package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "iplist.db"
	}

	db, err := InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	prefixRepo := NewPrefixRepo(db)
	vlanRepo := NewVLANRepo(db)
	addressRepo := NewAddressRepo(db)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
	}))

	r.Route("/api/v1", func(r chi.Router) {
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

		r.Route("/prefixes", func(r chi.Router) {
			r.Get("/", ListPrefixes(prefixRepo))
			r.Post("/", CreatePrefix(prefixRepo))
			r.Get("/{id}", GetPrefix(prefixRepo))
			r.Put("/{id}", UpdatePrefix(prefixRepo))
			r.Delete("/{id}", DeletePrefix(prefixRepo))
		})

		r.Route("/vlans", func(r chi.Router) {
			r.Get("/", ListVLANs(vlanRepo))
			r.Post("/", CreateVLAN(vlanRepo))
			r.Get("/{id}", GetVLAN(vlanRepo, prefixRepo))
			r.Put("/{id}", UpdateVLAN(vlanRepo))
			r.Delete("/{id}", DeleteVLAN(vlanRepo))
		})

		r.Route("/addresses", func(r chi.Router) {
			r.Get("/", ListAddresses(addressRepo))
			r.Post("/", CreateAddress(addressRepo, prefixRepo))
			r.Get("/{id}", GetAddress(addressRepo))
			r.Put("/{id}", UpdateAddress(addressRepo))
			r.Delete("/{id}", DeleteAddress(addressRepo))
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
