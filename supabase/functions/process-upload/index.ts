import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Environment validation
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const CORS_ORIGIN = Deno.env.get('CORS_ORIGIN') || 'https://smartvideo.app';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[process-upload] Missing required environment variables');
}

const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
  'image/avif', 'image/x-icon'
];
const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm',
  'video/x-msvideo', 'video/x-matroska', 'video/x-flv',
  'video/x-ms-wmv', 'video/3gpp', 'video/ogg', 'video/x-m4v'
];
const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/aac',
  'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a',
  'audio/opus', 'audio/x-ms-wma', 'audio/aiff', 'audio/x-aiff'
];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf'];

// Rate limiting
const uploadRateLimit = new Map<string, { count: number; resetTime: number }>();
const UPLOAD_RATE_LIMIT_MAX = 20;
const UPLOAD_RATE_LIMIT_WINDOW_MS = 60000;

function checkUploadRateLimit(clientId: string): boolean {
  const now = Date.now();
  const record = uploadRateLimit.get(clientId);
  
  if (!record || now > record.resetTime) {
    uploadRateLimit.set(clientId, { count: 1, resetTime: now + UPLOAD_RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= UPLOAD_RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

interface UploadRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
  base64Data: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Check environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({
        error: 'Server configuration error',
        message: 'Missing required server configuration'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Authenticate the user via Supabase JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Missing Authorization header' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized', message: 'Invalid or expired token' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  // Rate limiting by user ID
  const userId = user.id;
  if (!checkUploadRateLimit(userId)) {
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: 'Too many upload requests. Please try again later.'
      }),
      {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
      }
    );
  }

  try {
    const body: UploadRequest = await req.json();
    const { fileName, fileType, fileSize, base64Data } = body;

    // Validate input
    if (!fileName || !fileType || !fileSize || !base64Data) {
      return new Response(
        JSON.stringify({
          error: 'Invalid request',
          message: 'Missing required fields: fileName, fileType, fileSize, base64Data'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: 'File too large',
          message: `Maximum file size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
        }),
        {
          status: 413,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(fileType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(fileType);
    const isAudio = ALLOWED_AUDIO_TYPES.includes(fileType);
    const isDocument = ALLOWED_DOCUMENT_TYPES.includes(fileType);

    if (!isImage && !isVideo && !isAudio && !isDocument) {
      return new Response(
        JSON.stringify({
          error: 'Invalid file type',
          message: 'Only images, videos, audio files, and PDFs are allowed'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const ext = fileName.split('.').pop() || 'bin';
    const uniqueName = `${Date.now()}_${crypto.randomUUID()}.${ext}`;
    const path = `${userId}/${uniqueName}`;

    const base64Clean = base64Data.replace(/^data:[^;]+;base64,/, '');
    
    // Validate base64 data
    if (!/^[A-Za-z0-9+/=]+$/.test(base64Clean)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid file data',
          message: 'Invalid base64 encoding'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    const binaryData = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(path, binaryData, {
        contentType: fileType,
        upsert: false
      });

    if (uploadError) {
      console.error('[process-upload] Upload error:', uploadError);
      return new Response(
        JSON.stringify({
          error: 'Upload failed',
          message: uploadError.message
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(path);

    console.log(`[process-upload] File uploaded: ${path}`);

    return new Response(
      JSON.stringify({
        success: true,
        url: urlData.publicUrl,
        path,
        fileName: uniqueName,
        fileType,
        fileSize
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('[process-upload] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
