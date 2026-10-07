// Locks /travel/api/ to signed-in family members (server/auth.js), once accounts
// are switched on. Runs after functions/_middleware.js.
import { lock } from '../../../server/auth.js';
export const onRequest = lock;
