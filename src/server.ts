import app from './app.js';
import { ENV } from './config/env.js';

const PORT = Number(ENV.PORT) || 5000;
const HOST = '0.0.0.0';
const API_URL = 'https://ancc-constructions-1.onrender.com/api/v1';

app.listen(PORT, HOST, () => {
  console.log(`=================================================`);
  console.log(`  Construction Management System Backend API    `);
  console.log(`  API:     ${API_URL} `);
  console.log(`  Environment: ${ENV.NODE_ENV}                  `);
  console.log(`=================================================`);
});
