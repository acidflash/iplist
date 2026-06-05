# IPList

A self-hosted IP Address Management (IPAM) tool for tracking VLANs, IP prefixes, and individual IP addresses. Built with a Go backend and a React frontend, packaged as a two-container Docker application.

## Features

- **VLAN management** — create and manage VLANs with status tracking
- **Prefix management** — hierarchical prefix tree with utilization bars (CIDR-based)
- **IP address tracking** — hostname, DNS name, description, and status per address
- **Role-based access control** — `admin` (full access) and `read` (read-only) roles with JWT authentication
- **Data export** — download any list as CSV, JSON, or YAML
- **Numeric IP sorting** — addresses sorted correctly by numeric value, not lexicographically
- **Dark UI** — monospace-accented dark theme

## Tech stack

| Layer    | Technology                                      |
|----------|-------------------------------------------------|
| Backend  | Go 1.22, chi router, modernc SQLite (pure Go)  |
| Auth     | JWT (HS256, 24 h expiry), bcrypt passwords      |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS        |
| Routing  | React Router v6                                 |
| Serving  | Nginx (frontend), Go HTTP server (backend)      |
| Storage  | SQLite with WAL mode, persisted via Docker volume |

## Getting started

### Production (Docker Compose)

```bash
docker compose up -d
```

The app is available at [http://localhost:8080](http://localhost:8080).

Default credentials (change after first login):

| Username | Password | Role  |
|----------|----------|-------|
| admin    | admin    | Admin |
| reader   | reader   | Read  |

### Development

```bash
docker compose -f docker-compose.dev.yml up
```

Hot-reload is enabled for both the Go backend (`air`) and the Vite frontend dev server.

## Configuration

Configuration is loaded from a JSON file (default `config.json` in the working directory). Environment variables override any value in the file.

```jsonc
// config.json
{
  "db_path":    "iplist.db",
  "jwt_secret": "change-me-to-a-long-random-string",
  "port":       "8080"
}
```

Copy the example file to get started:

```bash
cp config.example.json config.json
```

Use a different config file with the `-config` flag:

```bash
./iplist -config /etc/iplist/config.json
```

| Key / Env variable       | Default                    | Description                  |
|--------------------------|----------------------------|------------------------------|
| `db_path` / `DB_PATH`    | `iplist.db`                | Path to the SQLite database  |
| `jwt_secret` / `JWT_SECRET` | `change-me-in-production` | Secret key for signing JWTs |
| `port` / `PORT`          | `8080`                     | Port the server listens on   |

Generate a strong JWT secret:

```bash
openssl rand -hex 32
```

## API

The REST API is available under `/api/v1/`. All endpoints except `POST /auth/login` require a `Bearer` token.

| Method | Path                  | Role  | Description            |
|--------|-----------------------|-------|------------------------|
| POST   | /auth/login           | —     | Obtain JWT token       |
| GET    | /auth/me              | read  | Current user info      |
| GET    | /stats                | read  | Dashboard stats        |
| GET    | /vlans                | read  | List VLANs             |
| POST   | /vlans                | admin | Create VLAN            |
| PUT    | /vlans/:id            | admin | Update VLAN            |
| DELETE | /vlans/:id            | admin | Delete VLAN            |
| GET    | /prefixes             | read  | List prefixes          |
| GET    | /prefixes/:id         | read  | Get prefix with IPs    |
| POST   | /prefixes             | admin | Create prefix          |
| PUT    | /prefixes/:id         | admin | Update prefix          |
| DELETE | /prefixes/:id         | admin | Delete prefix          |
| GET    | /addresses            | read  | List IP addresses      |
| POST   | /addresses            | admin | Create IP address      |
| PUT    | /addresses/:id        | admin | Update IP address      |
| DELETE | /addresses/:id        | admin | Delete IP address      |
| GET    | /users                | admin | List users             |
| POST   | /users                | admin | Create user            |
| PUT    | /users/:id            | admin | Update user            |
| DELETE | /users/:id            | admin | Delete user            |

## License

MIT
