import app from './app.js';
import { ENV } from './config/env.js';

const PORT = Number(ENV.PORT) || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`=================================================`);
  console.log(`  Construction Management System Backend API    `);
  console.log(`  Local:   http://localhost:${PORT}/api/v1       `);
  console.log(`  Network: http://0.0.0.0:${PORT}/api/v1         `);
  console.log(`  Environment: ${ENV.NODE_ENV}                  `);
  console.log(`=================================================`);
});
