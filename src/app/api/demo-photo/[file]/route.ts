import { NextResponse } from 'next/server';
import { yardScene } from '@/lib/demo/photos';

/**
 * Demo job imagery, rendered on request.
 *
 * The demo company needs before/after pairs that look like real job
 * documentation without shipping photographs of anyone's property, and without
 * writing files — a serverless filesystem is read-only. The scenes are a pure
 * function of the seed in the URL, so they are stable and cacheable forever.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<NextResponse> {
  const { file } = await params;
  const match = /^(before|after)-(\d{1,6})\.svg$/.exec(file);
  if (!match) return new NextResponse('Not found', { status: 404 });

  const svg = yardScene({ phase: match[1] as 'before' | 'after', seed: Number(match[2]) });
  return new NextResponse(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
