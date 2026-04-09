import type { ShopifyFileRow } from "../lib/variant-images.server";

type Props = {
  loading: boolean;
  files: ShopifyFileRow[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  assignedIds: Set<string>;
  onPickFile: (id: string) => void;
  onClose: () => void;
};

export function ShopifyFilesPanel({
  loading,
  files,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  assignedIds,
  onPickFile,
  onClose,
}: Props) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="base"
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="inline" gap="base">
          <s-heading>Shopify Files (images)</s-heading>
          <s-button variant="tertiary" onClick={onClose}>
            Close
          </s-button>
        </s-stack>
        <s-paragraph>
          App Bridge can only open pickers for products, variants, and collections.
          Search your store&apos;s Files and click a thumbnail to add its GID to this
          variant.
        </s-paragraph>
        <s-stack direction="inline" gap="small">
          <input
            type="search"
            name="filesSearch"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchSubmit();
              }
            }}
            placeholder="Search files — leave empty for recent images"
            style={{
              flex: 1,
              minWidth: 200,
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #c9cccf",
              fontSize: 14,
            }}
          />
          <s-button variant="secondary" onClick={onSearchSubmit} {...(loading ? { loading: true } : {})}>
            Search
          </s-button>
        </s-stack>
        {loading && files.length === 0 ? (
          <s-paragraph>Loading files…</s-paragraph>
        ) : null}
        {!loading && files.length === 0 ? (
          <s-paragraph>No image files found. Try another search or upload a new image.</s-paragraph>
        ) : null}
        {files.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              maxHeight: 280,
              overflowY: "auto",
              padding: 4,
            }}
          >
            {files.map((f) => {
              const added = assignedIds.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onPickFile(f.id)}
                  title={added ? "Already in list — click to append anyway" : "Add to variant"}
                  style={{
                    position: "relative",
                    padding: 0,
                    border: added ? "2px solid #008060" : "2px solid #e1e3e5",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: "#fff",
                    overflow: "hidden",
                    width: 88,
                    height: 88,
                  }}
                >
                  <img
                    src={f.url}
                    alt={f.altText ?? ""}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  {added ? (
                    <span
                      style={{
                        position: "absolute",
                        bottom: 2,
                        right: 2,
                        fontSize: 10,
                        background: "#008060",
                        color: "#fff",
                        padding: "1px 4px",
                        borderRadius: 4,
                      }}
                    >
                      In list
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </s-stack>
    </s-box>
  );
}
