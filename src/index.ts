import { createApp } from './server';

const PORT = Number(process.env.PORT) || 3000;

const { httpServer } = createApp();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ╔═══════════════════════════════════════════╗`);
  console.log(`  ║     PROVID Fluid Video Generator          ║`);
  console.log(`  ║     http://localhost:${PORT}               ║`);
  console.log(`  ╚═══════════════════════════════════════════╝\n`);
});
