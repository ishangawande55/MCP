# Transit keys for signing/verifying
path "transit/keys/*" {
  capabilities = ["read", "list"]
}

path "transit/sign/*" {
  capabilities = ["update"]
}

path "transit/verify/*" {
  capabilities = ["update"]
}

# Optional secret storage for app data
path "secret/data/mcp/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}