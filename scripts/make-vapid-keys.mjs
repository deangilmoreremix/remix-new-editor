// Prints a new VAPID key pair for Web Push notifications. Put the values in the Netlify site environment:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (secret!), VAPID_SUBJECT (mailto:you@example.com or an https URL)
// Usage: node scripts/make-vapid-keys.mjs
import { generateVapidKeys } from '../netlify/functions/_push/webPush.js'
const k = generateVapidKeys()
console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nVAPID_SUBJECT=mailto:you@example.com\n\nThe private key is a secret: store it only in the server environment, never in the frontend or the repository.`)
