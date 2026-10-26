import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, htmlLang, locales } from "@/i18n/config";
import { SITE_URL } from "@/lib/seo";
import { getDictionary } from "@/i18n/get-dictionary";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "../globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-serif-face",
  display: "swap",
});

// Runs before first paint so the saved theme never flashes
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark"}catch(e){}try{var a=JSON.parse(localStorage.getItem("a11y")||"null");if(a){var r=document.documentElement;if(a.font==="lg"||a.font==="xl")r.dataset.font=a.font;if(a.contrast===true)r.dataset.contrast="high";if(a.motion===true)r.dataset.motion="reduce"}}catch(e){}`;

export function generateStaticParams() {
  return locales.map((l) => ({ lang: l }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: dict.site.name, template: `%s · ${dict.site.name}` },
    description: dict.site.tagline,
    applicationName: dict.site.name,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  const dict = await getDictionary();

  return (
    <html lang={htmlLang[locale]} className={`${inter.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col bg-bg text-fg antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-brand-fg"
        >
          {dict.skipToContent}
        </a>
        <Header locale={locale} dict={dict} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer locale={locale} dict={dict} />
      </body>
    </html>
  );
}
