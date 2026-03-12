import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 800,
            color: "white",
            letterSpacing: -1,
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
