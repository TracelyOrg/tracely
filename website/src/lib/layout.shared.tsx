import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Tracely",
    },
    links: [
      {
        text: "Home",
        url: "/",
      },
    ],
  };
}
