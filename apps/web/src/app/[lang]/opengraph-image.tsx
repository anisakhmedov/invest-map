import { ImageResponse } from "next/og";

// Preview card for links shared in messengers and social networks. The built-in font only has Latin
// letters, so the card carries just the brand name and a simple map-like drawing.
export const alt = "InvestMap";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const rings = [90, 150, 210, 270, 330];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 90px",
          background: "#0b0f17",
          color: "#e8efeb",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 110, fontWeight: 700, color: "#45cfae", letterSpacing: -2 }}>InvestMap</div>
          <div style={{ marginTop: 18, width: 160, height: 8, background: "#e8a540", borderRadius: 4 }} />
        </div>
        <div style={{ display: "flex", position: "relative", width: 700, height: 630, alignItems: "center", justifyContent: "center" }}>
          {rings.map((r) => (
            <div
              key={r}
              style={{
                position: "absolute",
                width: r * 2,
                height: r * 1.7,
                borderRadius: "50%",
                border: "3px solid rgba(63, 195, 162, 0.55)",
              }}
            />
          ))}
          <div style={{ width: 26, height: 26, borderRadius: 13, background: "#45cfae", border: "5px solid #0b0f17" }} />
        </div>
      </div>
    ),
    size,
  );
}
