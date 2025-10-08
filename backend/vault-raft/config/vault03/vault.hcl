ui = true
disable_mlock = true

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = 1
}

storage "raft" {
  path    = "/vault/data"
  node_id = "vault03"
}

api_addr      = "http://127.0.0.1:8204"
cluster_addr  = "http://127.0.0.1:8205"