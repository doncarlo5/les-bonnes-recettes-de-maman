import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type OpenverseImage = {
  id: string;
  title: string | null;
  foreign_landing_url: string | null;
  url: string | null;
  creator: string | null;
  creator_url: string | null;
  license: string | null;
  license_version: string | null;
  license_url: string | null;
  provider: string | null;
  source: string | null;
  attribution: string | null;
  mature: boolean;
  thumbnail: string | null;
};

type OpenverseSearchResponse = {
  results: OpenverseImage[];
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();

  if (!query) {
    return Response.json(
      { error: "Missing query search parameter" },
      { status: 400 },
    );
  }

  const searchUrl = new URL("https://api.openverse.org/v1/images/");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("page_size", "12");
  searchUrl.searchParams.set("mature", "false");
  searchUrl.searchParams.set("license_type", "commercial,modification");

  const response = await fetch(searchUrl, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return Response.json(
      { error: "Openverse search failed" },
      { status: response.status },
    );
  }

  const data = (await response.json()) as OpenverseSearchResponse;

  return Response.json({
    results: data.results
      .filter((image) => image.url && image.foreign_landing_url)
      .map((image) => ({
        id: image.id,
        title: image.title ?? "Image Openverse",
        imageUrl: image.url,
        previewUrl: image.thumbnail ?? image.url,
        landingUrl: image.foreign_landing_url,
        creator: image.creator ?? "Createur inconnu",
        creatorUrl: image.creator_url ?? image.foreign_landing_url,
        license: image.license ?? "",
        licenseVersion: image.license_version ?? "",
        licenseUrl: image.license_url ?? image.foreign_landing_url,
        source: image.source ?? image.provider ?? "openverse",
        attribution: image.attribution ?? "",
        alt: image.title ?? "",
      })),
  });
}
