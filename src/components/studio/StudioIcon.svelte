<script lang="ts">
  import { STUDIO_ICONS, type StudioIconName } from "../../lib/studioIcons"

  type Props = { name: StudioIconName; class?: string }

  let { name, class: className }: Props = $props()
</script>

<span class={["icon", className]}>
  <svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">
    {@html STUDIO_ICONS[name]}
  </svg>
</span>
