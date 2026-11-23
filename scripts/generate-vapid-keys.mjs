#!/usr/bin/env node
/**
 * Prints a fresh VAPID key pair for Web Push. Nothing is written to disk.
 * Usage: node scripts/generate-vapid-keys.mjs
 * Then set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (Netlify env) and the public key in the client
 * (see docs/push-notifications.md). Never commit the private key.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com   # replace with a real contact');
