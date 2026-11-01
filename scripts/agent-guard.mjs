// Exit 1 (with a clear message) when the admin has paused or killed the agents, or switched this job off.
// Usage: node scripts/agent-guard.mjs <job>
import { assertRunning, Stopped } from '../agents/lib/control.mjs'
try { await assertRunning(process.argv[2]); console.log(`agent-guard: ${process.argv[2] || 'agents'} may run`) }
catch (e) { if (e instanceof Stopped) { console.error(`agent-guard: STOPPED. ${e.message}`); process.exit(1) } throw e }
