import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
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
          background: "#0b6b57",
          borderRadius: 14,
        }}
      >
        <div style={{ width: 38, height: 32, borderRadius: "50%", border: "4px solid #d9efe8", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 12, height: 12, borderRadius: 6, background: "#e8a540" }} />
        </div>
      </div>
    ),
    size,
  );
}
