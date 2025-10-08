#!/bin/bash
# Simulate persistent stdin connection
(
  echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'
  sleep 2
  echo '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
  sleep 2
  echo '{"jsonrpc":"2.0","id":3,"method":"ping","params":{}}'
  sleep 1
) | RUST_LOG=info ./target/debug/agent-browser-server 2>&1
