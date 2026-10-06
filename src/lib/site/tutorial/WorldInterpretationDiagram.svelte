<script lang="ts">
  type Example = "music" | "painting";
  let example = $state<Example>("music");
  let selected = $state(0);
  let times = $state([0, 1, 2, 3]);
  let durations = $state([1, 1, 2, 1]);
  let pitches = $state([60, 62, 64, 66]);
  let velocities = $state([80, 96, 64, 112]);
  let reds = $state([60, 62, 64, 66]);
  let greens = $state([80, 120, 180, 200]);
  let blues = $state([200, 180, 120, 80]);
  const uid = $props.id();
  const rows = $derived(
    example === "music"
      ? [
          { name: "time", label: "Time (beats)", values: times, min: 0, max: 4, step: 1 },
          {
            name: "duration",
            label: "Duration (beats)",
            values: durations,
            min: 1,
            max: 4,
            step: 1,
          },
          {
            name: "pitch",
            label: "Pitch (MIDI number)",
            values: pitches,
            min: 60,
            max: 72,
            step: 2,
          },
          {
            name: "velocity",
            label: "Velocity (strength)",
            values: velocities,
            min: 1,
            max: 127,
            step: 1,
          },
        ]
      : [
          { name: "red", label: "Red", values: reds, min: 0, max: 255, step: 1 },
          { name: "green", label: "Green", values: greens, min: 0, max: 255, step: 1 },
          { name: "blue", label: "Blue", values: blues, min: 0, max: 255, step: 1 },
        ],
  );
  const noteNames: Record<number, string> = {
    60: "C4",
    62: "D4",
    64: "E4",
    66: "F♯4",
    68: "G♯4",
    70: "A♯4",
    72: "C5",
  };
  const staffSteps: Record<number, number> = { 60: 0, 62: 1, 64: 2, 66: 3, 68: 4, 70: 5, 72: 7 };
  function update(name: string, value: number) {
    if (name === "time") times[selected] = value;
    else if (name === "duration") durations[selected] = value;
    else if (name === "pitch") pitches[selected] = value;
    else if (name === "velocity") velocities[selected] = value;
    else if (name === "red") reds[selected] = value;
    else if (name === "green") greens[selected] = value;
    else blues[selected] = value;
  }
  function exampleKey(event: KeyboardEvent) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    example =
      event.key === "Home"
        ? "music"
        : event.key === "End"
          ? "painting"
          : example === "music"
            ? "painting"
            : "music";
    document.getElementById(uid + "-" + example + "-tab")?.focus();
  }
  const colour = (i: number) => "rgb(" + [reds[i], greens[i], blues[i]].join(",") + ")";
</script>

<figure
  class="interpretation-artboard"
  class:painting={example === "painting"}
  aria-label="Several streams describe each note or brush mark"
>
  <figcaption class="intro">
    <span class="eyeline">From a selection to something you can use</span>
    <strong>Several streams. One note or brush mark.</strong>
    <p>
      Earlier, we chose four values from one stream. A World can put several streams together: value
      1 from each describes the first object, value 2 the next, and so on.
    </p>
  </figcaption>
  <div class="example-tabs" role="tablist" aria-label="Examples of several streams">
    <button
      id={uid + "-music-tab"}
      role="tab"
      type="button"
      tabindex={example === "music" ? 0 : -1}
      onkeydown={exampleKey}
      aria-selected={example === "music"}
      aria-controls={uid + "-example"}
      onclick={() => (example = "music")}>Musical score</button
    >
    <button
      id={uid + "-painting-tab"}
      role="tab"
      type="button"
      tabindex={example === "painting" ? 0 : -1}
      onkeydown={exampleKey}
      aria-selected={example === "painting"}
      aria-controls={uid + "-example"}
      onclick={() => (example = "painting")}>Painting · RGB</button
    >
  </div>
  <div
    id={uid + "-example"}
    role="tabpanel"
    aria-labelledby={uid + (example === "music" ? "-music-tab" : "-painting-tab")}
  >
    <p class="example-intro">
      {example === "music"
        ? "Pitch alone tells us which note. Time, duration and velocity tell us when it starts, how long it lasts and how strongly it is played."
        : "A colour needs three values: red, green and blue (RGB). A red stream alone cannot specify it. This painting combines one value from each channel for every brush mark."}
    </p>
    <div class="stream-table-wrap">
      <table
        aria-label={example === "music"
          ? "Four streams make four notes"
          : "Three streams make four brush marks"}
      >
        <thead
          ><tr
            ><th scope="col">Stream</th>{#each [0, 1, 2, 3] as i (i)}<th
                scope="col"
                class:selected={selected === i}>{example === "music" ? "Note" : "Mark"} {i + 1}</th
              >{/each}</tr
          ></thead
        >
        <tbody
          >{#each rows as row (row.name)}<tr
              ><th scope="row">{row.name}</th>{#each row.values as value, i (i)}<td
                  class:selected={selected === i}>{value}</td
                >{/each}</tr
            >{/each}</tbody
        >
      </table>
    </div>
    <div
      class="object-picker"
      role="group"
      aria-label={example === "music" ? "Choose a note to edit" : "Choose a brush mark to edit"}
    >
      {#each [0, 1, 2, 3] as i (i)}<button
          type="button"
          aria-pressed={selected === i}
          onclick={() => (selected = i)}>{example === "music" ? "Note" : "Mark"} {i + 1}</button
        >{/each}
    </div>
    <div class="art-layout">
      <div class="art-controls">
        <strong>Edit {example === "music" ? "note" : "mark"} {selected + 1}</strong>
        {#each rows as row (row.name)}
          <label for={uid + "-" + row.name}
            ><span>{row.label}<b>{row.values[selected]}</b></span>
            <input
              id={uid + "-" + row.name}
              type="range"
              min={row.min}
              max={row.max}
              step={row.step}
              value={row.values[selected]}
              oninput={(event) => update(row.name, Number(event.currentTarget.value))}
            />
          </label>
        {/each}
      </div>
      <div class="drawing-canvas">
        {#if example === "music"}
          <svg
            viewBox="0 0 660 270"
            role="img"
            aria-label={"Score preview. Selected note " +
              (selected + 1) +
              ": " +
              noteNames[pitches[selected]] +
              ", starts at beat " +
              times[selected] +
              ", lasts " +
              durations[selected] +
              " beats, velocity " +
              velocities[selected]}
          >
            <rect class="paper" x="8" y="8" width="644" height="254" rx="12"></rect>
            {#each [65, 75, 85, 95, 105] as line (line)}<line
                class="staff"
                x1="35"
                x2="625"
                y1={line}
                y2={line}
              ></line>{/each}
            <text class="clef" x="34" y="111">𝄞</text>
            {#each pitches as pitch, i (i)}
              {@const x = 90 + times[i] * 95}
              {@const y = 115 - staffSteps[pitch] * 5}
              <g class:chosen={selected === i}>
                {#if pitch === 60}<line class="staff" x1={x - 17} x2={x + 17} y1="115" y2="115"
                  ></line>{/if}
                <ellipse
                  class="note"
                  class:held={durations[i] >= 2}
                  cx={x}
                  cy={y}
                  rx="9"
                  ry="6"
                  transform={"rotate(-18 " + x + " " + y + ")"}
                  style:opacity={0.35 + (velocities[i] / 127) * 0.65}
                ></ellipse>
                {#if durations[i] < 4}<line class="stem" x1={x + 8} x2={x + 8} y1={y} y2={y - 34}
                  ></line>{/if}
                {#if durations[i] === 3}<circle class="duration-dot" cx={x + 17} cy={y} r="2"
                  ></circle>{/if}
                {#if [66, 68, 70].includes(pitch)}<text class="accidental" x={x - 24} y={y + 5}
                    >♯</text
                  >{/if}
                <text class="note-label" {x} y="147" text-anchor="middle">{noteNames[pitch]}</text>
                <rect
                  class="duration-bar"
                  {x}
                  y={168 + i * 16}
                  width={durations[i] * 34}
                  height="8"
                  rx="4"
                ></rect>
              </g>
            {/each}
            <text class="chart-label" x="35" y="247"
              >Bars show duration · stronger notes look darker</text
            >
          </svg>
          <output aria-live="polite"
            >Note {selected + 1}: {noteNames[pitches[selected]]} · beat {times[selected]} · {durations[
              selected
            ]}
            {durations[selected] === 1 ? "beat" : "beats"} long · strength {velocities[
              selected
            ]}</output
          >
        {:else}
          <svg
            viewBox="0 0 500 280"
            role="img"
            aria-label={"Painting preview. Mark " +
              (selected + 1) +
              " has RGB " +
              [reds[selected], greens[selected], blues[selected]].join(", ")}
          >
            <rect class="paint-paper" x="8" y="8" width="484" height="264" rx="12"></rect>
            {#each [0, 1, 2, 3] as i (i)}
              <g
                transform={"translate(" +
                  (40 + (i % 2) * 225) +
                  " " +
                  (40 + Math.floor(i / 2) * 110) +
                  ")"}
              >
                <path
                  class:chosen={selected === i}
                  fill={colour(i)}
                  d="M2 18 Q48 -5 92 11 L161 3 L169 16 L153 32 L174 44 L157 61 Q96 78 47 66 L4 76 L13 49 L0 38Z"
                ></path>
                <text class="paint-label" x="85" y="93" text-anchor="middle"
                  >{i + 1}: RGB {reds[i]}, {greens[i]}, {blues[i]}</text
                >
              </g>
            {/each}
          </svg>
          <output aria-live="polite"
            >Mark {selected + 1}: red {reds[selected]} + green {greens[selected]} + blue {blues[
              selected
            ]}</output
          >
        {/if}
      </div>
    </div>
    <p class="reading">
      {example === "music"
        ? "The pitch row starts with our earlier 60, 62, 64, 66 selection. Pick a note, then change just its duration. Its pitch stays the same; a different stream changes another property of that same note."
        : "The red stream follows the same pattern as our earlier selection: start at 60 and add 2. Pick a brush mark and move just Red. Green and Blue stay unchanged; all three values still describe that same mark."}
    </p>
  </div>
  <div class="world-contract">
    <strong>Who decides how the streams fit together? The World.</strong>
    <p>
      These local examples group values by their position in each stream. The score uses beats and
      MIDI pitch numbers; the painting uses RGB channels from 0 to 255 and fixes the marks’
      positions and shapes. A real World documents its own units, ranges and grouping.
    </p>
    <p>
      To generate these examples, you would select a stream for each property. Referencing pitch
      alone still gives a pitch stream; it does not automatically add the other properties. These
      previews don’t save definitions or run network requests.
    </p>
  </div>
</figure>

<style>
  .interpretation-artboard {
    --art-ink: #ecfbf3;
    --art-muted: #bdd9ce;
    --art-accent: #8ae0b7;
    display: grid;
    gap: 1.3rem;
    margin: 0;
    padding: clamp(1rem, 3vw, 1.8rem);
    border: 1px solid #658d7e;
    border-radius: 1.2rem;
    background: radial-gradient(ellipse at 100% 0%, #32534d 0, transparent 65%), #162b32;
    color: var(--art-ink) !important;
    min-width: 0;
  }
  .interpretation-artboard.painting {
    --art-ink: #ffeced;
    --art-muted: #dfc1cf;
    --art-accent: #f2a2b8;
    background: radial-gradient(ellipse at 100% 0%, #643c53 0, transparent 65%), #302438;
    border-color: #906079;
  }
  .intro {
    display: grid;
    gap: 0.6rem;
  }
  .eyeline {
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    color: var(--art-muted) !important;
  }
  .interpretation-artboard strong {
    color: var(--art-ink) !important;
  }
  .intro strong {
    font-size: clamp(1.2rem, 3vw, 1.65rem);
    line-height: 1.35;
  }
  .interpretation-artboard p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.8;
    color: var(--art-muted) !important;
  }
  .example-tabs,
  .object-picker {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  button {
    padding: 0.5rem 0.8rem;
    border: 1px solid color-mix(in srgb, var(--art-accent) 50%, transparent);
    border-radius: 0.5rem;
    background: transparent !important;
    color: var(--art-ink) !important;
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
  }
  button[aria-selected="true"],
  button[aria-pressed="true"] {
    background: var(--art-accent) !important;
    color: #222836 !important;
  }
  .example-intro {
    margin-bottom: 1rem !important;
  }
  .stream-table-wrap {
    min-width: 0;
    overflow-x: auto;
  }
  .interpretation-artboard table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 0 0 1rem;
    color: var(--art-ink) !important;
    font-size: 0.8rem;
    text-align: center;
  }
  .interpretation-artboard :is(th, td) {
    padding: 0.45rem;
    color: var(--art-ink) !important;
    border: 0;
    background: transparent;
  }
  th:first-child {
    text-align: left;
  }
  .interpretation-artboard .selected {
    background: color-mix(in srgb, var(--art-accent) 15%, transparent);
  }
  thead th {
    font-size: 0.7rem;
    color: var(--art-muted) !important;
  }
  .art-layout {
    display: grid;
    grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.5fr);
    gap: 1.5rem;
    margin-block: 1.3rem;
    align-items: center;
  }
  .art-controls {
    display: grid;
    gap: 0.85rem;
  }
  .art-controls strong {
    font-size: 0.8rem;
  }
  label {
    display: grid;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: var(--art-muted) !important;
  }
  label span {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  label b {
    color: var(--art-ink) !important;
  }
  input {
    width: 100%;
    accent-color: var(--art-accent);
    background: transparent !important;
    cursor: pointer;
  }
  button:focus-visible,
  input:focus-visible {
    outline: 2px solid #f8d376;
    outline-offset: 3px;
  }
  .drawing-canvas {
    min-width: 0;
  }
  svg {
    width: 100%;
    display: block;
  }
  .paper {
    fill: #e4ede2;
  }
  .staff {
    stroke: #52675d;
    stroke-width: 1;
  }
  .clef {
    fill: #324b42;
    font: 65px serif;
  }
  .note {
    fill: #163c32;
  }
  .note.held {
    fill: #e4ede2;
    stroke: #163c32;
    stroke-width: 2;
  }
  .stem {
    stroke: #163c32;
    stroke-width: 2;
  }
  .duration-dot {
    fill: #163c32;
  }
  .accidental {
    fill: #163c32;
    font: 20px serif;
  }
  .note-label,
  .chart-label {
    fill: #3b5249;
    font:
      12px system-ui,
      sans-serif;
  }
  .duration-bar {
    fill: #38765d;
  }
  .chosen .note,
  .chosen .duration-bar {
    fill: #985228;
  }
  .chosen .note.held {
    fill: #e4ede2;
  }
  .chosen .note {
    stroke: #985228;
    stroke-width: 2;
  }
  .paint-paper {
    fill: #f2dfc8;
  }
  .paint-label {
    fill: #533c44;
    font:
      11px system-ui,
      sans-serif;
  }
  path.chosen {
    stroke: #533c44;
    stroke-width: 2;
    stroke-dasharray: 5 4;
  }
  output {
    display: block;
    text-align: center;
    color: var(--art-ink) !important;
    font-size: 0.75rem;
    line-height: 1.6;
    margin-top: 0.75rem;
  }
  .reading {
    padding-left: 0.75rem;
    border-left: 2px solid var(--art-accent);
  }
  .world-contract {
    display: grid;
    gap: 0.6rem;
    padding-top: 1rem;
    border-top: 1px solid color-mix(in srgb, var(--art-accent) 35%, transparent);
  }
  .world-contract strong {
    font-size: 0.85rem;
  }
  @media (max-width: 650px) {
    .art-layout {
      grid-template-columns: 1fr;
    }
    .art-controls {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .art-controls > strong {
      grid-column: 1 / -1;
    }
    .interpretation-artboard :is(th, td) {
      padding: 0.35rem 0.25rem;
    }
  }
</style>
