import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return Response.json(
      { error: "UNSPLASH_ACCESS_KEY is not set" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    downloadLocation?: string;
  };
  const downloadLocation = body.downloadLocation?.trim();

  if (!downloadLocation) {
    return Response.json(
      { error: "Missing downloadLocation" },
      { status: 400 },
    );
  }

  let url: URL;

  try {
    url = new URL(downloadLocation);
  } catch {
    return Response.json(
      { error: "Invalid Unsplash download URL" },
      { status: 400 },
    );
  }

  if (url.origin !== "https://api.unsplash.com") {
    return Response.json(
      { error: "Invalid Unsplash download URL" },
      { status: 400 },
    );
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      { error: "Unsplash download tracking failed" },
      { status: response.status },
    );
  }

  return Response.json({ ok: true });
}
