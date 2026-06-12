import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/ia", "/planos", "/entrar", "/cadastro"],
        disallow: ["/app/", "/api/", "/admin/", "/desconto/"],
      },
    ],
    sitemap: "https://faleinglesjv.com/sitemap.xml",
  };
}
