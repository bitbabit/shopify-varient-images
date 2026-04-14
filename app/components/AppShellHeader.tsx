import type { CSSProperties } from "react";
import { Link } from "react-router";

import appLogo from "../assets/favicon/favicon.svg?url";
import { POLARIS_PAGE_BASE_MAX_INLINE_STYLE } from "../lib/polaris-layout";

type Props = {
  docsUrl: string;
};

const navLinkStyle: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  color: "#202223",
  textDecoration: "none",
  border: "1px solid transparent",
  display: "inline-block",
};

export function AppShellHeader({ docsUrl }: Props) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: POLARIS_PAGE_BASE_MAX_INLINE_STYLE,
        marginLeft: "auto",
        marginRight: "auto",
        marginBottom: 8,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        padding: "12px 16px",
        background: "linear-gradient(180deg, #ffffff 0%, #f9fafb 100%)",
        border: "1px solid #e1e3e5",
        borderRadius: 12,
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
      }}
    >
      <Link
        to="/app"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          minWidth: 0,
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <img
          src={appLogo}
          alt=""
          width={32}
          height={32}
          style={{
            flexShrink: 0,
            objectFit: "contain",
            borderRadius: 8,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "-0.02em",
              color: "#111",
              lineHeight: 1.25,
            }}
          >
            BitBabit: Variant Images
          </div>
          <div style={{ fontSize: 11, color: "#6d7175", marginTop: 2 }}>
            Per-variant galleries for your storefront
          </div>
        </div>
      </Link>
      <nav
        aria-label="App"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        <Link to="/app" style={navLinkStyle}>
          Home
        </Link>
        <Link to="/app/pricing" style={navLinkStyle}>
          Pricing
        </Link>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={navLinkStyle}
        >
          Documentation
        </a>
      </nav>
    </div>
  );
}
