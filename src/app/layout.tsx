import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Тут все — поиск",
  description: "Поиск специалистов, подрядчиков, площадок и команд сообщества «Тут все».",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
