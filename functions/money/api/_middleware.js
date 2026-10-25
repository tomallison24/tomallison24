// Locks /money/api/ to signed-in family members (server/auth.js), once accounts
// are switched on; the route itself then lets in only Money's reader and those
// the reader shares it with. Runs after functions/_middleware.js.
import { lock } from '../../../server/auth.js';
export const onRequest = lock;
