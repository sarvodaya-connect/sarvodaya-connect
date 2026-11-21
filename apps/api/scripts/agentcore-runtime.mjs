import { createAgentCoreRuntime } from '../dist/assistant/agentcore-runtime.js';

createAgentCoreRuntime().listen(8080, '0.0.0.0');
