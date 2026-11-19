import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // อนุญาตให้หน้า /checkin ขอสิทธิ์ GPS และใช้ WebAuthn (สแกนนิ้ว) ได้
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "geolocation=(self), publickey-credentials-get=(self), publickey-credentials-create=(self)" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
