import type { MetadataRoute } from "next";

/** Makes Bill Split installable; iPhones only allow notifications for sites added to the Home Screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bill Split",
    short_name: "Bill Split",
    description: "Split shared costs and Walmart orders with the people you live with",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8f3",
    theme_color: "#f7f8f3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
