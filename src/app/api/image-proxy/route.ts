import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing image URL parameter' },
        { status: 400 }
      );
    }

    // Validate that the URL is from allowed domains for security
    const allowedDomains = [
      'ark-content-generation-v2-cn-beijing.tos-cn-beijing.volces.com',
      'tos-cn-beijing.volces.com',
      'pub-23959c61a0814f2a91a19cc37b24a893.r2.dev', // R2 public domain
      'manga.neodomain.ai' // Production R2 domain
    ];

    const urlObj = new URL(imageUrl);
    const isAllowedDomain = allowedDomains.some(domain =>
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json(
        { error: 'Unauthorized domain' },
        { status: 403 }
      );
    }

    // Fetch the image from VolcEngine
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StoryToManga/1.0)',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);

      // If it's a 403 (Forbidden), the URL might be expired
      if (response.status === 403) {
        console.warn('Image URL appears to be expired (403 Forbidden)');
        // Return a placeholder or error image instead of failing completely
        return NextResponse.json(
          { error: 'Image URL expired', expired: true },
          { status: 410 } // Gone - indicates the resource is no longer available
        );
      }

      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await response.arrayBuffer();

    // Return the image with proper headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}