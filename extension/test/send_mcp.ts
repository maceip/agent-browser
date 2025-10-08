const ws = new WebSocket('ws://127.0.0.1:8085');

ws.addEventListener('open', () => {
  console.log('✓ Connected to agent-browser-server WebSocket');
  
  const message = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'passkey_enable',
    params: { enabled: true }
  };
  
  console.log('📤 Sending:', JSON.stringify(message, null, 2));
  ws.send(JSON.stringify(message));
});

ws.addEventListener('message', (event) => {
  console.log('📥 Response:', event.data);
  ws.close();
});

ws.addEventListener('error', (error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

ws.addEventListener('close', () => {
  console.log('Connection closed');
  process.exit(0);
});
