import {kv,sessionUser} from '../../../server/auth.js';
import {createGateway} from '../../../labs/ipsy-warrior/cloud/gateway.mjs';
export const onRequest=createGateway({kv,sessionUser});
