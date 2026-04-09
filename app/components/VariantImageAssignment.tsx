import { useCallback, useRef } from "react";
import type { ProductImageOption } from "../lib/variant-images.server";

type Preview = { url: string; altText?: string | null };

function moveIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type Props = {
  variantTitle: string;
  orderedGids: string[];
  previewByGid: Record<string, Preview>;
  productImages: ProductImageOption[];
  uploading: boolean;
  browsingFiles: boolean;
  saving: boolean;
  onReorder: (next: string[]) => void;
  onRemove: (gid: string) => void;
  onAddFromProduct: (gid: string) => void;
  onPickFiles: () => void;
  onUpload: () => void;
  onSave: () => void;
};

export function VariantImageAssignment({
  variantTitle,
  orderedGids,
  previewByGid,
  productImages,
  uploading,
  browsingFiles,
  saving,
  onReorder,
  onRemove,
  onAddFromProduct,
  onPickFiles,
  onUpload,
  onSave,
}: Props) {
  const dragFrom = useRef<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    dragFrom.current = index;
  }, []);

  const handleDropOn = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      const from = dragFrom.current;
      dragFrom.current = null;
      if (from === null || from === toIndex) return;
      onReorder(moveIndex(orderedGids, from, toIndex));
    },
    [onReorder, orderedGids],
  );

  const moveUp = useCallback(
    (index: number) => {
      if (index <= 0) return;
      onReorder(moveIndex(orderedGids, index, index - 1));
    },
    [onReorder, orderedGids],
  );

  const moveDown = useCallback(
    (index: number) => {
      if (index >= orderedGids.length - 1) return;
      onReorder(moveIndex(orderedGids, index, index + 1));
    },
    [onReorder, orderedGids],
  );

  const assignedSet = new Set(orderedGids);

  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="subdued"
    >
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-100">
          <s-heading>{variantTitle}</s-heading>
        </s-stack>

        <s-stack direction="inline" gap="small">
          <s-button
            variant="secondary"
            onClick={onPickFiles}
            {...(uploading || browsingFiles ? { loading: true } : {})}
          >
            Browse Shopify Files
          </s-button>
          <s-button
            variant="secondary"
            onClick={onUpload}
            {...(uploading ? { loading: true } : {})}
          >
            Upload new
          </s-button>
          <s-button
            variant="primary"
            onClick={onSave}
            {...(saving ? { loading: true } : {})}
          >
            Save
          </s-button>
        </s-stack>

        {productImages.length > 0 ? (
          <s-stack direction="block" gap="small">
            <s-text type="strong">Add from this product&apos;s images</s-text>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "flex-start",
              }}
            >
              {productImages.map((img) => {
                const already = assignedSet.has(img.id);
                return (
                  <button
                    key={img.id}
                    type="button"
                    disabled={already}
                    onClick={() => onAddFromProduct(img.id)}
                    title={already ? "Already in list" : "Add to this variant"}
                    style={{
                      position: "relative",
                      padding: 0,
                      border: already ? "2px solid #008060" : "2px solid #e1e3e5",
                      borderRadius: 8,
                      cursor: already ? "default" : "pointer",
                      background: "#fff",
                      overflow: "hidden",
                      width: 72,
                      height: 72,
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.altText ?? ""}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        opacity: already ? 0.5 : 1,
                      }}
                    />
                    {already ? (
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
                        Added
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </s-stack>
        ) : null}

        {orderedGids.length === 0 ? (
          <s-paragraph>
            No images yet. Pick from product images above, from Files, or upload.
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="small">
            <s-text type="strong">Order for this variant</s-text>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {orderedGids.map((gid, index) => {
                const p = previewByGid[gid];
                return (
                  <div
                    key={gid}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDropOn(e, index)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 12px",
                      background: "#fff",
                      border: "1px solid #e1e3e5",
                      borderRadius: 8,
                      cursor: "grab",
                    }}
                  >
                    <span
                      style={{
                        minWidth: 28,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#6d7175",
                      }}
                    >
                      {index + 1}
                    </span>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 6,
                        overflow: "hidden",
                        background: "#f6f6f7",
                        flexShrink: 0,
                      }}
                    >
                      {p?.url ? (
                        <img
                          src={p.url}
                          alt={p.altText ?? ""}
                          width={72}
                          height={72}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            color: "#8c9196",
                            textAlign: "center",
                            padding: 4,
                          }}
                        >
                          Loading…
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6d7175",
                          wordBreak: "break-all",
                          fontFamily: "monospace",
                        }}
                      >
                        {gid.replace("gid://shopify/MediaImage/", "…/")}
                      </div>
                    </div>
                    <s-stack direction="inline" gap="small-100">
                      <s-button
                        variant="tertiary"
                        onClick={() => moveUp(index)}
                        disabled={index === 0}
                      >
                        Up
                      </s-button>
                      <s-button
                        variant="tertiary"
                        onClick={() => moveDown(index)}
                        disabled={index === orderedGids.length - 1}
                      >
                        Down
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() => onRemove(gid)}
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </div>
                );
              })}
            </div>
          </s-stack>
        )}
      </s-stack>
    </s-box>
  );
}
