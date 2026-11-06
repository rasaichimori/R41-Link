<script lang="ts" module>
  export type PixelIconName =
    | "app"
    | "start"
    | "studio"
    | "close"
    | "minimize"
    | "maximize"
    | "help"
    | "play"
    | "stop"
    | "rewind"
    | "folder"
    | "signal"
</script>

<script lang="ts">
  type Props = { name: PixelIconName; class?: string; hidden?: boolean }

  let { name, class: className, hidden = true }: Props = $props()

  const LIT = "#a9bb5c"
  const DARK = "#1f2a12"
  /** 2×3 LCD blocks: which of the six cells are lit, top-left to bottom-right */
  const CELL_POSITIONS: [number, number][] = [
    [0, 0],
    [4, 0],
    [0, 4],
    [4, 4],
    [0, 8],
    [4, 8],
  ]
  const CELLS_LIT = {
    app: [true, false, true, false, true, true],
    start: [false, true, false, false, true, false],
  }

  const VIEWBOX: Record<PixelIconName, string> = {
    app: "0 0 8 12",
    start: "0 0 8 12",
    studio: "0 0 12 12",
    close: "0 0 8 7",
    minimize: "0 0 8 8",
    maximize: "0 0 9 8",
    help: "0 0 8 8",
    play: "0 0 8 9",
    stop: "0 0 8 8",
    rewind: "0 0 9 9",
    folder: "0 0 32 26",
    signal: "0 0 12 12",
  }

  const PATHS: Partial<Record<PixelIconName, string>> = {
    close:
      "M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3zM2 4h4v1H2zM1 5h2v1H1zM5 5h2v1H5zM0 6h2v1H0zM6 6h2v1H6z",
    minimize: "M1 6h6v2H1z",
    maximize: "M0 0h9v2H0zM0 2h1v6H0zM8 2h1v6H8zM1 7h7v1H1z",
    help: "M2 0h4v1H2zM1 1h1v2H1zM6 1h1v2H6zM5 3h1v1H5zM4 4h1v1H4zM3 4h1v2H3zM3 7h2v1H3z",
    play: "M1 0h1v9H1zM2 1h1v7H2zM3 2h1v5H3zM4 3h1v3H4zM5 4h1v1H5z",
    stop: "M1 1h6v6H1z",
    rewind: "M1 0h2v9H1zM7 0h1v9H7zM6 1h1v7H6zM5 2h1v5H5zM4 3h1v3H4z",
  }
</script>

<svg class={className} viewBox={VIEWBOX[name]} aria-hidden={hidden ? "true" : undefined} shape-rendering="crispEdges">
  {#if name === "app" || name === "start"}
    {#each CELL_POSITIONS as [x, y], i (`${x},${y}`)}
      <rect {x} {y} width="3" height="3" fill={CELLS_LIT[name][i] ? LIT : DARK} />
    {/each}
  {:else if name === "studio"}
    <rect x="1" y="0" width="2" height="2" fill={DARK} />
    <rect x="5" y="0" width="2" height="2" fill={DARK} />
    <rect x="9" y="0" width="2" height="2" fill={DARK} />
    <rect x="0" y="2" width="12" height="8" fill={DARK} />
    <rect x="1" y="3" width="10" height="6" fill={LIT} />
    <rect x="1" y="10" width="2" height="2" fill={DARK} />
    <rect x="5" y="10" width="2" height="2" fill={DARK} />
    <rect x="9" y="10" width="2" height="2" fill={DARK} />
  {:else if name === "folder"}
    <path fill="#000" d="M1 3h11v1H1zM12 4h1v2h-1zM13 6h16v1H13zM0 4h1v21H0zM29 7h1v18h-1zM1 25h28v1H1z" />
    <path fill="#e8c840" d="M1 4h11v2h1v1h16v18H1z" />
    <path fill="#fff8b0" d="M1 4h11v1H1zM1 5h1v19H1z" />
    <path fill="#a08010" d="M2 24h27v1H2zM28 8h1v16h-1z" />
  {:else if name === "signal"}
    <path fill="currentColor" d="M1 4h2v4H1zM3 3h1v6H3zM4 2h1v8H4zM5 1h1v10H5zM8 3h1v1H8zM9 4h1v4H9zM8 8h1v1H8z" />
  {:else}
    <path d={PATHS[name]} />
  {/if}
</svg>
