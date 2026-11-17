export const brand = {
  name: 'SmartVid',
  slug: 'smartvid',
  prefix: 'smartvid',
  version: '0.1.0',
  envVar: 'SMARTVID_API_KEY',
  gatewayEnvVar: 'SMARTVID_API_URL',
  gatewayUrl: 'https://smartvid.app/api/mcp-gateway',
};

// Bundled snapshot ids whose backend route differs (live route check).
export const endpointFixes = {
  'ai-image-upscaler': 'ai-image-upscale',
  'bytedance-seedream-5.0-pro-edit': 'seedream-5.0-pro-edit',
  'bytedance-seedream-5.0-pro': 'seedream-5.0-pro',
};
