import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
          borderRadius: 36,
          background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
        }}
      >
        <span
          style={{
            fontSize: 90,
            fontWeight: 800,
            color: "white",
            letterSpacing: -4,
            lineHeight: 1,
          }}
        >
          NQ
        </span>
      </div>
    ),
    { ...size }
  );
}
