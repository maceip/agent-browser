#!/bin/bash
# Test script to simulate MCP client
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | RUST_LOG=info ./target/debug/agent-browser-server
