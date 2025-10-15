# HashiCorp Vault Cluster Docker Compose Documentation

## 📋 Overview

This Docker Compose configuration sets up a 3-node HashiCorp Vault cluster for high availability and secure secret management. The cluster provides enterprise-grade security features for cryptographic operations, transit engine capabilities, and secure storage of sensitive data.

## 🏗️ Cluster Architecture

![Cluster Architecture](diagrams/Cluster%20Architecture.png)

## 🎯 Key Features

- **🔐 High Availability**: 3-node cluster with automatic failover
- **🔄 Integrated Storage**: Raft consensus for data consistency
- **🔒 Security Hardened**: IPC_LOCK capability for memory locking
- **📦 Persistent Data**: Volume mounts for data persistence
- **🚀 Production Ready**: Restart policies and proper configuration
- **🔧 Scalable**: Easy to add more nodes to the cluster

## 📁 File Structure

```
vault-cluster/
├── docker-compose.yml
├── config/
│   ├── vault01/
│   │   └── vault.hcl
│   ├── vault02/
│   │   └── vault.hcl
│   └── vault03/
│       └── vault.hcl
└── data/
    ├── vault01/
    ├── vault02/
    └── vault03/
```

## 🔧 Service Configuration Details

### Vault Service Definition

```yaml
services:
  vault01:
    image: hashicorp/vault:1.14.0
    container_name: vault01
    restart: always
    ports:
      - "8200:8200"
    cap_add:
      - IPC_LOCK
    volumes:
      - ./config/vault01:/vault/config
      - ./data/vault01:/vault/data
    command: vault server -config=/vault/config/vault.hcl
```

### Configuration Breakdown

![Configuration Breakdown](diagrams/Configuration%20Breakdown.png)

## 🛠️ Vault Configuration Files

### Sample vault.hcl for vault01

```hcl
# Vault Configuration File
storage "raft" {
  path    = "/vault/data"
  node_id = "vault01"
  
  # Cluster configuration
  retry_join {
    leader_api_addr = "http://vault01:8200"
  }
  retry_join {
    leader_api_addr = "http://vault02:8200"
  }
  retry_join {
    leader_api_addr = "http://vault03:8200"
  }
}

# API listener configuration
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1  # Enable TLS in production
}

# Seal configuration (development)
seal "transit" {
  address = "http://vault01:8200"
  token   = "root"
  key_name = "unseal_key"
}

# API configuration
api_addr = "http://vault01:8200"
cluster_addr = "http://vault01:8201"
ui = true
```

### Cluster Network Configuration

![Cluster Network](diagrams/Cluster%20Network.png)

## 🚀 Deployment Commands

### Starting the Cluster

```bash
# Create necessary directories
mkdir -p {config,data}/{vault01,vault02,vault03}

# Generate configuration files for each node
./generate_config.sh

# Start the cluster
docker-compose up -d

# Check cluster status
docker-compose ps
```

### Cluster Initialization

```bash
# Initialize the first node
docker exec -it vault01 vault operator init

# Save the unseal keys and root token securely
# Unseal all nodes
docker exec -it vault01 vault operator unseal [KEY1]
docker exec -it vault01 vault operator unseal [KEY2]
docker exec -it vault01 vault operator unseal [KEY3]

# Repeat for other nodes with the same keys
docker exec -it vault02 vault operator unseal [KEY1]
# ... etc
```

### Health Checking

```bash
#!/bin/bash
# cluster_health.sh

echo "🔍 Checking Vault Cluster Health..."

for node in vault01 vault02 vault03; do
  echo "Checking $node..."
  docker exec $node vault status
  if [ $? -eq 0 ]; then
    echo "✅ $node: Healthy"
  else
    echo "❌ $node: Unhealthy"
  fi
  echo "---"
done
```

## 💡 Configuration Generator Script

```bash
#!/bin/bash
# generate_config.sh

CLUSTER_NAME="municipal-vault"
NODES=("vault01" "vault02" "vault03")

for i in "${!NODES[@]}"; do
  NODE="${NODES[$i]}"
  CONFIG_DIR="config/$NODE"
  mkdir -p $CONFIG_DIR
  
  cat > "$CONFIG_DIR/vault.hcl" << EOF
# $NODE Configuration
storage "raft" {
  path    = "/vault/data"
  node_id = "$NODE"
  
  retry_join {
    leader_api_addr = "http://vault01:8200"
  }
  retry_join {
    leader_api_addr = "http://vault02:8200"
  }
  retry_join {
    leader_api_addr = "http://vault03:8200"
  }
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_disable   = 1
}

api_addr = "http://$NODE:8200"
cluster_addr = "http://$NODE:8201"
cluster_name = "$CLUSTER_NAME"
ui = true
EOF

  echo "Generated config for $NODE"
done
```

## 🔒 Security Considerations

### Production Security Hardening

```yaml
# Enhanced docker-compose.security.yml
services:
  vault01:
    # ... existing config
    environment:
      - VAULT_TLS_DISABLE=0
      - VAULT_ADDR=https://127.0.0.1:8200
    volumes:
      - ./tls/vault01.crt:/vault/config/server.crt
      - ./tls/vault01.key:/vault/config/server.key
      - ./tls/ca.crt:/vault/config/ca.crt
    cap_drop:
      - ALL
    cap_add:
      - IPC_LOCK
    read_only: true
    security_opt:
      - no-new-privileges:true
```

### TLS Configuration Example

```hcl
# Production TLS configuration
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/vault/config/server.crt"
  tls_key_file  = "/vault/config/server.key"
  tls_client_ca_file = "/vault/config/ca.crt"
}
```

## 📊 Monitoring & Logging

### Docker Compose with Logging

```yaml
services:
  vault01:
    # ... existing config
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "vault", "status", "-format=json"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Log Management Script

```bash
#!/bin/bash
# check_logs.sh

echo "📋 Vault Cluster Logs"
echo "===================="

for node in vault01 vault02 vault03; do
  echo ""
  echo "🔍 $node logs:"
  docker logs --tail 20 $node | grep -E "(error|warn|unseal|seal)"
done
```

## 🔄 Operational Commands

### Common Management Tasks

```bash
# Scale the cluster
docker-compose up -d --scale vault01=1 --scale vault02=1 --scale vault03=1

# View cluster members
docker exec -it vault01 vault operator raft list-peers

# Take snapshot
docker exec -it vault01 vault operator raft snapshot save backup.snap

# Restore from snapshot
docker exec -it vault01 vault operator raft snapshot restore backup.snap

# Check seal status
docker exec -it vault01 vault status
```

### Backup and Recovery

```bash
#!/bin/bash
# backup_cluster.sh

BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo "💾 Backing up Vault cluster..."

# Backup configuration
cp -r config/* $BACKUP_DIR/

# Backup data via snapshot
docker exec -it vault01 vault operator raft snapshot save /vault/data/backup.snap
docker cp vault01:/vault/data/backup.snap $BACKUP_DIR/cluster.snap

echo "✅ Backup completed: $BACKUP_DIR"
```

## 🐛 Troubleshooting Guide

### Common Issues and Solutions

```bash
# Node won't start
docker-compose logs vault01 | tail -20

# Cannot join cluster
docker exec -it vault01 vault operator raft list-peers

# Storage issues
docker exec -it vault01 ls -la /vault/data/

# Network connectivity
docker exec -it vault01 ping vault02
```

### Health Check Script

```bash
#!/bin/bash
# health_check.sh

echo "🏥 Vault Cluster Health Check"
echo "============================"

check_node() {
    local node=$1
    if docker ps | grep -q $node; then
        echo "✅ $node: Container running"
        if docker exec $node vault status 2>/dev/null | grep -q "Sealed"; then
            local sealed=$(docker exec $node vault status --format=json | jq -r '.sealed')
            if [ "$sealed" = "false" ]; then
                echo "   ✅ $node: Unsealed"
            else
                echo "   ❌ $node: Sealed"
            fi
        else
            echo "   ⚠️ $node: Cannot check status"
        fi
    else
        echo "❌ $node: Container not running"
    fi
}

for node in vault01 vault02 vault03; do
    check_node $node
done
```

## 🚀 Production Deployment Checklist

- [ ] **TLS Certificates**: Configure proper TLS for all nodes
- [ ] **Seal Configuration**: Set up auto-unseal or transit seal
- [ ] **Backup Strategy**: Regular snapshot backups
- [ ] **Monitoring**: Health checks and alerting
- [ ] **Access Control**: Proper policies and authentication
- [ ] **Network Security**: Firewall rules and network policies
- [ ] **Resource Limits**: CPU and memory constraints
- [ ] **Log Aggregation**: Centralized logging solution

---

**Author**: Ishan Gawande  
**Version**: 1.1.0  
**Vault Version**: 1.14.0  
**Architecture**: 3-node Raft cluster  
**Security**: IPC_LOCK, persistent storage, restart policies  
**License**: MIT