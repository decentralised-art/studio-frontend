<script lang="ts">
  const { type, position, id } = $props<{
    type?: string;
    position?: string;
    id?: string;
  }>();
</script>

<div data-testid="mock-handle" data-type={type} data-position={position} data-handle-id={id}></div>
