import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type UnsplashPhoto = {
  id: string;
  alt_description: string | null;
  description: string | null;
  urls: {
    regular: string;
    small: string;
  };
  links: {
    html: string;
    download_location: string;
  };
  user: {
    name: string;
    links: {
      html: string;
    };
  };
};

type UnsplashSearchResponse = {
  results: UnsplashPhoto[];
};

const utmSource = "les_bonnes_recettes_de_maman";

export async function GET(request: NextRequest) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    return Response.json(
      { error: "UNSPLASH_ACCESS_KEY is not set" },
      { status: 500 },
    );
  }

  const query = request.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return Response.json(
      { error: "Missing query search parameter" },
      { status: 400 },
    );
  }

  const searchUrl = new URL("https://api.unsplash.com/search/photos");
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("per_page", "12");
  searchUrl.searchParams.set("orientation", "landscape");
  searchUrl.searchParams.set("content_filter", "high");
  searchUrl.searchParams.set("order_by", "relevant");

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      { error: "Unsplash search failed" },
      { status: response.status },
    );
  }

  const data = (await response.json()) as UnsplashSearchResponse;

  return Response.json({
    results: data.results.map((photo) => ({
      id: photo.id,
      imageUrl: photo.urls.regular,
      previewUrl: photo.urls.small,
      alt: photo.alt_description ?? photo.description ?? "",
      photographerName: photo.user.name,
      photographerUrl: withUtm(photo.user.links.html),
      photoUrl: withUtm(photo.links.html),
      downloadLocation: photo.links.download_location,
    })),
  });
}

function withUtm(url: string) {
  const nextUrl = new URL(url);
  nextUrl.searchParams.set("utm_source", utmSource);
  nextUrl.searchParams.set("utm_medium", "referral");
  return nextUrl.toString();
}
