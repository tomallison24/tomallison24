// Makes the notification server's key pair, once. Run on your own computer:
//   node mail/push/make-vapid-keys.mjs
// and add the two lines it prints as GitHub secrets (see mail/README.md).
// The phone uses the public key to check that notifications really come from
// your server; the private key never leaves the Worker's secrets.
import { makeKeys } from './webpush.js';

const k = await makeKeys();
console.log('VAPID_PUBLIC_KEY  ' + k.publicKey);
console.log('VAPID_PRIVATE_KEY ' + k.privateKey);
