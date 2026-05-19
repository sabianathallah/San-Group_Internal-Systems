import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test untuk setiap test file
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
