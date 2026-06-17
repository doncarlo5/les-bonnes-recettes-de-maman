import { ImageResponse } from "next/og";
import { brand, chefHatSvg, svgDataUri } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Branded Apple touch icon: chef-hat glyph on terracotta.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.terracotta,
          borderRadius: 40,
        }}
      >
        <img
          width={116}
          height={116}
          src={svgDataUri(chefHatSvg(brand.cream))}
          alt=""
        />
      </div>
    ),
    { ...size },
  );
}
