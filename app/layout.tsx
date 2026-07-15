import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "도트말씨 | 레트로 게임 한글화 공방";
const description =
  "옛 게임의 말씨를 한 칸씩, 근거로 완성하는 비공식 레트로 게임 한글화 공방. 번역, 독립 검수, 기술 QA와 안전한 배포 기록을 공개합니다.";

async function requestOrigin() {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return new URL(`${protocol}://${host}`);
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = await requestOrigin();

  return {
    metadataBase: origin,
    title: {
      default: title,
      template: "%s | 도트말씨",
    },
    description,
    applicationName: "도트말씨",
    creator: "도트말씨",
    publisher: "도트말씨",
    keywords: [
      "도트말씨",
      "레트로 게임",
      "한글화",
      "팬 번역",
      "게임 한글 패치",
      "독립 검수",
    ],
    alternates: {
      canonical: "/",
      languages: {
        "ko-KR": "/",
      },
    },
    robots: {
      index: true,
      follow: true,
    },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url: origin,
      siteName: "도트말씨",
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    icons: {
      icon: "/brand/dotmalssi-mark-16.svg",
      shortcut: "/brand/dotmalssi-mark-16.svg",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#17213A",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
