(() => {
  const BLANK_SOURCE_IMAGE =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const numberOr = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

  const uniqueSampleSets = (notes, fallback) => {
    const sets = new Set();
    notes.forEach((note) => {
      const sampleSet = Math.round(numberOr(note.sampleSet, fallback));
      if (sampleSet >= 1 && sampleSet <= 5) sets.add(sampleSet);
    });
    if (sets.size === 0) sets.add(fallback);
    return [...sets];
  };

  const getToneRowParams = (address) => {
    const sampleSet = clamp(Math.round(numberOr(address.sampleSet, 1)), 1, 5);
    const visualSet = clamp(Math.round(numberOr(address.visualSet, sampleSet)), 1, 5);
    return {
      thisset: visualSet,
      sampleSet,
      colors: Array.isArray(address.colors) ? address.colors : [1, 1, 0.5],
      randomNumber: clamp(Math.round(numberOr(address.visualNumber, 12)), 1, 50),
      randomShape: clamp(Math.round(numberOr(address.visualShape, 4)), 3, 9),
      randomSetting1: clamp(Math.round(numberOr(address.visualSetting1, 8)), 3, 15),
      randomSetting2: clamp(Math.round(numberOr(address.visualSetting2, 8)), 1, 30),
      randomSetting3: clamp(Math.round(numberOr(address.visualSetting3, 2)), 1, 5),
      bigRandom: clamp(Math.round(numberOr(address.bigNumber, 30)), 1, 100),
      randomRotate: clamp(Math.round(numberOr(address.rotate, 1)), 1, 4),
      invert: address.invert ? 2 : 1,
      iterationForSet: clamp(Math.round(numberOr(address.visualVariant, 1)), 1, 4),
      reactivity: clamp(numberOr(address.reactivity, 1), 0, 8),
    };
  };

  const calculateTotalDuration = (notes) =>
    notes.reduce((endTime, note) => Math.max(endTime, note.time + note.duration), 0);

  const createTypewriter = (element, initialLines, period) => {
    let active = true;
    let lines = initialLines;
    let loopNum = 0;
    let text = "";
    let deleting = false;
    let timeout = 0;

    const tick = () => {
      if (!active || !element) return;
      const fullText = lines[loopNum % lines.length] ?? "";
      text = deleting
        ? fullText.substring(0, text.length - 1)
        : fullText.substring(0, text.length + 1);
      element.innerHTML = `<span class="wrap">${text}</span>`;

      let delta = 150 - Math.random() * 100;
      if (deleting) delta /= 2;
      if (!deleting && text === fullText) {
        delta = period;
        deleting = true;
      } else if (deleting && text === "") {
        deleting = false;
        loopNum += 1;
        delta = 500;
      }
      timeout = window.setTimeout(tick, delta);
    };

    tick();

    return {
      setLines(nextLines) {
        lines = nextLines.length > 0 ? nextLines : [""];
        loopNum = 0;
        text = "";
        deleting = false;
      },
      dispose() {
        active = false;
        window.clearTimeout(timeout);
      },
    };
  };

  window.createToneRowWorldRuntime = ({
    root,
    Tone,
    assetBase,
    initialState,
    onRendered,
    onError,
  }) => {
    const loadingStatus = root.querySelector("#loadingStatus");
    const nowPlaying = root.querySelector("#nowPlaying");
    const content = root.querySelector("#content");
    const contentText = root.querySelector(".typewrite");
    const hash = root.querySelector("#hash");
    const container = root.querySelector(".container");

    let state = initialState;
    let playable = Boolean(initialState.isPlayable);
    let renderable = Boolean(initialState.hasVisualMaterial);
    let params = getToneRowParams(initialState.address);
    let sounds = initialState.composition.notes.map((note) => ({ ...note }));
    let totalDuration = calculateTotalDuration(sounds);
    let samplersBySet = {};
    let samplersInitiated = false;
    let playing = false;
    let stopped = false;
    let part;
    let hydra;
    let analyzer;
    let fft;
    let meter;
    let visualInterval = 0;
    let updateInterval = 0;
    const activeTypewriterLines = ["Tone World", "click anywhere to start/stop the sound"];
    const visualTypewriterLines = ["Tone World", "visual connector loaded"];
    const waitingTypewriterLines = ["Tone World", "waiting for connector material"];
    const getTypewriterLines = () => {
      if (playable) return activeTypewriterLines;
      if (renderable) return visualTypewriterLines;
      return waitingTypewriterLines;
    };
    const getIdleStatusText = () => {
      if (playable) return `Duration: ${totalDuration.toFixed(2)}s`;
      if (renderable) return "Visual connector loaded";
      return "No connector material";
    };
    const typewriter = createTypewriter(contentText, getTypewriterLines(), 4000);

    const setLoading = (loading) => {
      if (!playable) {
        loadingStatus.style.display = "none";
        content.style.display = "block";
        return;
      }
      loadingStatus.textContent = "Loading sounds...";
      loadingStatus.style.display = loading ? "block" : "none";
      content.style.display = loading ? "none" : "block";
    };

    const postError = (message) => {
      if (typeof onError === "function") onError(message);
    };

    const disposeSamplers = () => {
      Object.values(samplersBySet).forEach((samplers) => {
        samplers.forEach((sampler) => sampler.dispose());
      });
      samplersBySet = {};
      samplersInitiated = false;
    };

    const stopPlayback = (reloadSamplers) => {
      if (part) {
        part.stop();
        part.dispose();
        part = undefined;
      }
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
      window.clearInterval(updateInterval);
      playing = false;
      stopped = true;
      nowPlaying.innerHTML = getIdleStatusText();
      nowPlaying.style.color = "black";
      if (reloadSamplers && playable) {
        disposeSamplers();
        setLoading(true);
        void initializeAndLoadSamplers();
      }
    };

    const ensureAnalyzers = () => {
      if (analyzer && fft && meter) return;
      analyzer = new Tone.Analyser("waveform", 1024);
      fft = new Tone.FFT(32);
      meter = new Tone.Meter();
    };

    const connectSamplerAnalysis = (sampler) => {
      ensureAnalyzers();
      sampler.connect(analyzer);
      sampler.connect(fft);
      sampler.connect(meter);
      sampler.toDestination();
    };

    const initializeAndLoadSamplers = async () => {
      if (!playable) {
        setLoading(false);
        return;
      }
      setLoading(true);
      if (!samplersInitiated) {
        ensureAnalyzers();
        const sampleSets = uniqueSampleSets(sounds, params.sampleSet);
        sampleSets.forEach((sampleSet) => {
          if (samplersBySet[sampleSet]) return;
          samplersBySet[sampleSet] = Array.from({ length: 12 }, (_, index) => {
            const sampler = new Tone.Sampler({
              urls: { C1: `${assetBase}/samples/samples-${sampleSet}/${index + 1}.mp3` },
              attack: 10,
              release: 10,
            });
            connectSamplerAnalysis(sampler);
            return sampler;
          });
        });
        await Tone.loaded();
        samplersInitiated = true;
      }
      setLoading(false);
    };

    const updateTimeRemaining = (start, duration, ifstopped) => {
      const currentTime = Tone.Transport.seconds;
      const timeElapsed = currentTime - start;
      const timeRemaining = duration - timeElapsed;
      nowPlaying.innerHTML = `Time Remaining: ${timeRemaining.toFixed(2)}s`;
      nowPlaying.style.color = "green";

      if (timeRemaining <= 0 || ifstopped) {
        window.clearInterval(updateInterval);
        nowPlaying.innerHTML = `Duration: ${duration.toFixed(2)}s`;
        nowPlaying.style.color = "black";
      }
    };

    const startPlayback = async () => {
      if (!playable) return;
      if (!samplersInitiated) await initializeAndLoadSamplers();
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
      await Tone.start();
      Tone.context.resume();

      part = new Tone.Part((time, value) => {
        const sampleSet = value.sampleSet || params.sampleSet;
        const samplerIndex = clamp(Math.round(numberOr(value.sample, 1)), 1, 12) - 1;
        const selectedSampler = samplersBySet[sampleSet]?.[samplerIndex];
        if (selectedSampler?.loaded) {
          selectedSampler.triggerAttackRelease(
            Math.max(8, numberOr(value.frequency, 55)),
            Math.max(0.05, numberOr(value.duration, 1)),
            time,
            clamp(numberOr(value.velocity, 0.7), 0.05, 1),
          );
        }
      }, sounds).start(0);

      Tone.Transport.scheduleOnce(() => {
        playing = false;
        stopped = true;
      }, totalDuration);

      Tone.Transport.start();
      playing = true;
      stopped = false;
      const startTime = Tone.Transport.seconds;
      updateInterval = window.setInterval(() => {
        updateTimeRemaining(startTime, totalDuration, stopped);
      }, 100);
    };

    const handleClick = () => {
      if (!playable) return;
      if (!playing) {
        void startPlayback().catch((error) => {
          postError(error instanceof Error ? error.message : "Could not start Tone World audio.");
        });
      } else {
        stopPlayback(true);
      }
    };

    const resizeCanvas = () => {
      const windowHeight = window.innerHeight;
      const windowWidth = window.innerWidth;
      const edge = windowHeight >= windowWidth ? windowWidth : windowHeight;
      document.body.style.width = `${edge}px`;
      document.body.style.height = `${edge}px`;
      content.style.fontSize = `${edge * 0.05}px`;
      nowPlaying.style.fontSize = `${edge * 0.03}px`;
      hash.style.fontSize = `${edge * 0.03}px`;
    };

    const initHydra = () => {
      if (hydra || typeof window.Hydra !== "function") return;
      hydra = new window.Hydra({ detectAudio: false });
      s0.initImage(BLANK_SOURCE_IMAGE);
      visualInterval = window.setInterval(renderToneRowHydraFrame, 100);
    };

    const refreshUi = () => {
      totalDuration = calculateTotalDuration(sounds);
      nowPlaying.innerHTML = getIdleStatusText();
      nowPlaying.style.color = "black";
      hash.innerHTML = `Iteration: ${state.hashLabel}`;
      typewriter.setLines(getTypewriterLines());
      if (container) container.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
      if (hydra) s0.initImage(BLANK_SOURCE_IMAGE);
    };

    const getAnalysisValues = () => {
      const waveform = analyzer ? analyzer.getValue() : [0];
      const rawAmplitude =
        Array.from(waveform).reduce((acc, val) => acc + Math.abs(val), 0) /
        Math.max(1, waveform.length);
      const silentPulse =
        renderable && !playable
          ? (params.reactivity / 8) * 0.05 * (1 + Math.sin(performance.now() / 700))
          : 0;
      const amplitude = Math.min(1, rawAmplitude * Math.max(0.05, params.reactivity) + silentPulse);
      const frequencyData = fft ? fft.getValue() : Array.from({ length: 32 }, () => 0);
      const treble = frequencyData[31] ?? 0;
      const volume = meter ? meter.getValue() : -Infinity;
      return { amplitude, treble, volume };
    };

    function renderToneRowHydraFrame() {
      if (!renderable) {
        solid(1, 1, 1, 0).out(o0);
        render(o0);
        return;
      }
      const { amplitude, treble, volume } = getAnalysisValues();
      const {
        thisset,
        colors,
        randomNumber,
        randomShape,
        randomSetting1,
        randomSetting2,
        randomSetting3,
        bigRandom,
        randomRotate,
        invert,
        iterationForSet,
      } = params;

      if (thisset === 1) {
        const threshold = -12;
        const secondthreshold = -8;

        if (iterationForSet === 1) {
          if (invert - 1) {
            if (volume > threshold && volume < secondthreshold) {
              src(o2).pixelate(Math.abs(treble), Math.abs(treble)).invert().out(o2);
            } else if (volume > secondthreshold) {
              src(o2)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .invert()
                .out(o2);
            } else {
              voronoi(randomSetting2, (randomNumber / 2) * amplitude, randomSetting3).out(o1);
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .invert()
                .out(o0);
              src(o0).modulate(o1).out(o2);
              render(o2);
            }
          } else {
            if (volume > threshold && volume < secondthreshold) {
              src(o2).pixelate(Math.abs(treble), Math.abs(treble)).out(o2);
            } else if (volume > secondthreshold) {
              src(o2)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .out(o2);
            } else {
              voronoi(randomSetting2, (randomNumber / 2) * amplitude, randomSetting3).out(o1);
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .invert()
                .out(o0);
              src(o0).modulate(o1).out(o2);
              render(o2);
            }
          }
        } else if (iterationForSet === 2) {
          if (invert - 1) {
            if (volume > threshold && volume < secondthreshold) {
              src(o0).pixelate(Math.abs(treble), Math.abs(treble)).invert().out(o0);
            } else if (volume > secondthreshold) {
              src(o0)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .invert()
                .out(o0);
            } else {
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .invert()
                .out(o0);
            }
          } else {
            if (volume > threshold && volume < secondthreshold) {
              src(o0).pixelate(Math.abs(treble), Math.abs(treble)).out(o0);
            } else if (volume > secondthreshold) {
              src(o0)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .out(o0);
            } else {
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .out(o0);
            }
          }
        } else if (iterationForSet === 3) {
          if (invert - 1) {
            if (volume > threshold && volume < secondthreshold) {
              src(o2).pixelate(Math.abs(treble), Math.abs(treble)).invert().out(o2);
            } else if (volume > secondthreshold) {
              src(o2)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .invert()
                .out(o2);
            } else {
              noise(randomSetting2, randomNumber / 5, randomSetting3).out(o1);
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .invert()
                .out(o0);
              src(o0).modulate(o1).out(o2);
              render(o2);
            }
          } else {
            if (volume > threshold && volume < secondthreshold) {
              src(o2).pixelate(Math.abs(treble), Math.abs(treble)).out(o2);
            } else if (volume > secondthreshold) {
              src(o2)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .out(o2);
            } else {
              noise(randomSetting2, randomNumber / 5, randomSetting3).out(o1);
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .out(o0);
              src(o0).modulate(o1).out(o2);
              render(o2);
            }
          }
        } else if (iterationForSet === 4) {
          if (invert - 1) {
            if (volume > threshold && volume < secondthreshold) {
              src(o2).pixelate(Math.abs(treble), Math.abs(treble)).invert().out(o2);
            } else if (volume > secondthreshold) {
              src(o2)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .invert()
                .out(o2);
            } else {
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .invert()
                .posterize(randomSetting2, randomNumber / 5)
                .out(o2);
              render(o2);
            }
          } else {
            if (volume > threshold && volume < secondthreshold) {
              src(o2).pixelate(Math.abs(treble), Math.abs(treble)).out(o2);
            } else if (volume > secondthreshold) {
              src(o2)
                .pixelate(Math.abs(treble) * 10, Math.abs(treble))
                .out(o2);
            } else {
              osc(10, 0.1, amplitude * 10)
                .blend(noise(amplitude * 1.5 + 0.5))
                .color(colors[0], colors[1], colors[2])
                .modulate(src(s0), 1)
                .posterize(randomSetting2, randomNumber / 5)
                .out(o2);
              render(o2);
            }
          }
        }
      } else if (thisset === 2) {
        container.style.backgroundColor = "rgba(255, 255, 255, 0.8)";

        if (iterationForSet === 1) {
          if (invert - 1) {
            shape(randomShape, randomShape * 0.1, 0.1)
              .invert()
              .repeat(randomSetting2, randomSetting2, 0.0, 0.0)
              .modulateRepeatX(
                osc(0.1, 5, 1).rotate(Math.sin(0.5 * randomSetting3)),
                0.1 * randomSetting3 + amplitude * 10 * randomSetting3,
                0.1 * randomSetting3 + amplitude * 50 * randomSetting3,
              )
              .rotate(randomSetting2)
              .modulate(src(s1), 0.5)
              .modulate(src(s0), 0.5)
              .out(o0);
            src(o0).modulate(o1).out(o2);
            render(o2);
          } else {
            osc(10, 0.01, 0.05).out(o1);
            shape(randomShape, randomShape * 0.1, 0.1)
              .repeat(randomSetting2, randomSetting2, 0.0, 0.0)
              .modulateRepeatX(
                osc(0.1, 5, 1).rotate(Math.sin(0.5 * randomSetting3)),
                0.1 * randomSetting3 + amplitude * 10 * randomSetting3,
                0.1 * randomSetting3 + amplitude * 50 * randomSetting3,
              )
              .rotate(randomSetting2)
              .modulate(src(s1), 0.5)
              .modulate(src(s0), 0.5)
              .out(o0);
            src(o0).modulate(o1).out(o2);
            render(o2);
          }
        } else if (iterationForSet === 2) {
          if (invert - 1) {
            shape(randomShape, randomNumber * 0.01, 0.2)
              .invert()
              .repeat(
                5 + amplitude * 1500,
                5 + amplitude * 1500,
                0.0 + amplitude * 1500,
                0.0 + amplitude * 1500,
              )
              .modulateRepeatX(osc(0.1, randomSetting1 / 10, 1).rotate(Math.sin(1)), 0.5, 1.5)
              .modulate(src(s0), 1)
              .out(o0);
          } else {
            shape(randomShape, randomNumber * 0.01, 0.2)
              .repeat(
                1 + amplitude * 1500,
                5 + amplitude * 1500,
                0.0 + amplitude * 1500,
                0.0 + amplitude * 1500,
              )
              .modulateRepeatX(osc(0.1, randomSetting1 / 10, 1).rotate(Math.sin(1)), 0.5, 1.5)
              .modulate(src(s0), 0.15)
              .out(o0);
          }
        } else if (iterationForSet === 3) {
          osc(10, 0.01, 0.05).out(o1);
          const row = shape(4, randomShape * 0.1, 0.1);
          (invert - 1 ? row.invert() : row)
            .repeat(randomSetting2, randomSetting2, randomSetting2, randomSetting2)
            .modulateRepeatY(
              osc(0.01, 5, 1).rotate(Math.sin(0.1 * randomSetting3)),
              0.1 * randomSetting3 + amplitude * 10 * randomSetting3,
              0.1 * randomSetting3 + amplitude * 50 * randomSetting3,
            )
            .rotate(randomSetting2)
            .modulate(src(s1), 0.15)
            .out(o0);
          src(o0).modulate(o1).out(o2);
          render(o2);
        } else if (iterationForSet === 4) {
          osc(10, 0.01, 0.05).out(o1);
          const row = shape(3, randomShape * 0.1, 0.1);
          (invert - 1 ? row.invert() : row)
            .repeat(randomSetting2, randomSetting2, randomSetting2, randomSetting2)
            .modulateRepeatY(
              osc(0.01, 5, 1).rotate(Math.sin(0.1 * randomSetting3)),
              0.1 * randomSetting3 + amplitude * 10 * randomSetting3,
              0.1 * randomSetting3 + amplitude * 50 * randomSetting3,
            )
            .rotate(randomSetting2)
            .modulate(src(s1), 0.15)
            .modulate(src(s0), 1)
            .out(o0);
          src(o0).modulate(o1).out(o2);
          render(o2);
        }
      } else if (thisset === 3) {
        container.style.backgroundColor = "rgba(255, 255, 255, 0.5)";

        if (iterationForSet === 1) {
          const row = shape(4, randomShape * 0.1, 0.1)
            .color(colors[0], colors[1], colors[2])
            .modulateRotate(shape(randomShape * amplitude * 10, 0.1, 0.1))
            .mult(osc(20, 0.1, 0.5).rotate(1.58))
            .diff(o0)
            .modulateScale(noise(1, 0), -0.03)
            .scale(0.8, ({ time }) => 1.05 + 0.1 * Math.sin(0.1 * time))
            .repeat(
              invert - 1 ? randomSetting2 : randomSetting1,
              invert - 1 ? randomSetting2 : randomSetting1,
              0,
              0,
            )
            .modulateRotate(
              shape(randomShape * amplitude * 10, 0.1, 0.1).repeat(
                randomSetting1,
                randomSetting1,
                0,
                0,
              ),
              30,
            )
            .blend(noise(amplitude * 1.5 + 0.5))
            .color(colors[0], colors[1], colors[2])
            .rotate(randomSetting2);
          (invert - 1 ? row.invert() : row.modulate(src(s0), 1)).out(o0);
          src(o0).modulate(o1).out(o2);
          render(o0);
        } else if (iterationForSet === 2) {
          const row = shape(3, randomShape * 0.2, 0.5)
            .color(
              colors[0] * amplitude * (invert - 1 ? 10 : 1),
              colors[1] * amplitude * (invert - 1 ? 1 : 10),
              colors[2] * amplitude * 10,
            )
            .modulateRotate(shape(randomShape, 0.1, 0.1))
            .mult(osc(20, 0.1, 0.5).rotate(1.58))
            .diff(o0)
            .modulateScale(noise(1, 0), -0.03)
            .scale(0.8, ({ time }) => 1.05 + 0.1 * Math.sin(0.1 * time))
            .repeat(
              invert - 1 ? randomSetting2 : randomSetting1,
              invert - 1 ? randomSetting2 : randomSetting1,
              0,
              0,
            )
            .blend(noise(randomSetting3))
            .color(colors[0], colors[1], colors[2])
            .rotate(randomSetting2);
          (invert - 1 ? row.invert() : row.modulate(src(s0), 1)).out(o0);
          src(o0).modulate(o1).out(o2);
          render(o0);
        } else if (iterationForSet === 3) {
          const row = shape(4, 0.2, randomShape * 0.5)
            .color(colors[0], colors[1], colors[2])
            .modulateRotate(shape(randomShape + amplitude * randomNumber, 0.1, 0.1))
            .mult(osc(20, 0.1, 0.5).rotate(1.58))
            .diff(o0)
            .modulateScale(noise(1, 0), -0.03 - amplitude * randomNumber)
            .scale(0.8, ({ time }) => 1.05 + 0.1 * Math.sin(0.1 * time))
            .repeat(
              invert - 1 ? randomSetting2 : randomSetting1,
              invert - 1 ? randomSetting2 : randomSetting1,
              0,
              0,
            )
            .blend(noise(randomSetting3))
            .color(colors[0], colors[1], colors[2])
            .rotate(randomSetting2);
          (invert - 1 ? row.invert() : row.modulate(src(s0), 1)).out(o0);
          src(o0).modulate(o1).out(o2);
          render(o0);
        } else if (iterationForSet === 4) {
          const row = voronoi(4, 0.2, randomShape * 0.5)
            .color(colors[0], colors[1], colors[2])
            .modulateRotate(shape(randomSetting2 + amplitude * randomNumber, 0.1, 0.1))
            .mult(osc(20, 0.1, 0.5).rotate(1.58))
            .diff(o0)
            .modulatePixelate(noise(randomSetting3, 0), -0.03 - amplitude * randomNumber)
            .scale(0.8, ({ time }) => 1.05 + 0.1 * Math.sin(0.1 * time))
            .repeat(randomSetting3, randomSetting3, 0, 0)
            .blend(noise(randomSetting3))
            .color(colors[0], colors[1], colors[2])
            .rotate(randomSetting2);
          (invert - 1 ? row.invert() : row.modulate(src(s0), 1)).out(o0);
          src(o0).modulate(o1).out(o2);
          render(o0);
        }
      } else if (thisset === 4) {
        container.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
        const threshold = -20;
        const secondthreshold = -15;

        if (iterationForSet === 1 || iterationForSet === 2) {
          const oscFrequency = iterationForSet === 1 ? 10 : amplitude * 10;
          const row = osc(
            oscFrequency,
            iterationForSet === 1 ? 0.1 : 0.5,
            iterationForSet === 1 ? amplitude * 10 : 10,
          )
            .blend(noise(amplitude * 0.1 + 0.5).rotate(bigRandom))
            .color(
              ({ time }) => Math.sin(time) + bigRandom / 10,
              ({ time }) => Math.sin(time) + bigRandom / 100,
              ({ time }) => Math.sin(time) + bigRandom / 100,
            )
            .modulate(
              voronoi(randomSetting2, randomSetting2, randomSetting2)
                .thresh(0.5, 0.5)
                .modulateRepeatX(
                  osc(10 + amplitude),
                  1.0,
                  ({ time }) => Math.sin(time) + bigRandom / 100,
                )
                .color(colors[0], colors[1], colors[2])
                .rotate(90 * randomRotate),
              1,
            );
          (invert - 1 ? row.invert() : row).modulate(src(s0), 0.1).out(o0);
          render(o0);
        } else if (iterationForSet === 3) {
          if (volume > threshold && volume < secondthreshold) {
            src(o0).pixelate(Math.abs(treble), Math.abs(treble)).out(o0);
          } else if (volume > secondthreshold) {
            src(o0)
              .pixelate(Math.abs(treble) * 10, Math.abs(treble))
              .out(o0);
          } else {
            const row = osc(amplitude, 0.5, 10)
              .blend(noise(amplitude * 0.1 + 0.5).rotate(bigRandom))
              .color(
                ({ time }) => Math.sin(time) + bigRandom / 10,
                ({ time }) => Math.sin(time) + bigRandom / 100,
                ({ time }) => Math.sin(time) + bigRandom / 100,
              )
              .modulate(
                voronoi(randomSetting2, randomSetting2, randomSetting2)
                  .thresh(0.5, 0.5)
                  .modulateRepeatX(
                    osc(10 + amplitude),
                    1.0,
                    ({ time }) => Math.sin(time) + bigRandom / 100,
                  )
                  .color(colors[0], colors[1], colors[2])
                  .rotate(90 * randomRotate),
                1,
              );
            (invert - 1 ? row.invert() : row).modulate(src(s0), 0.1).out(o0);
            render(o0);
          }
        } else if (iterationForSet === 4) {
          if (volume > threshold && volume < secondthreshold) {
            src(o0)
              .modulatePixelate(noise(bigRandom, Math.abs(treble) / 10), 100)
              .out(o0);
          } else if (volume > secondthreshold) {
            src(o0)
              .modulatePixelate(noise(bigRandom, Math.abs(treble) / 10), 100)
              .out(o0);
          } else {
            const row = osc(amplitude, 0.5, 10)
              .blend(noise(amplitude * 0.1 + 0.5).rotate(bigRandom))
              .color(colors[0], colors[1], colors[2])
              .modulate(
                voronoi(randomSetting2, randomSetting2, randomSetting2)
                  .thresh(0.1, 0.7)
                  .modulateRepeatX(
                    osc(10 + amplitude),
                    1.0,
                    ({ time }) => Math.sin(time) + bigRandom / 100,
                  )
                  .color(colors[0], colors[1], colors[2])
                  .rotate(90 * randomRotate),
                1,
              )
              .modulate(src(s0), 0.1)
              .pixelate(100, 100);
            (invert - 1 ? row.invert() : row).out(o0);
            render(o0);
          }
        }
      } else if (thisset === 5) {
        container.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
        const scaleAmount = iterationForSet === 1 || iterationForSet === 3 ? 1.05 : 7.17;
        const scaleWave = iterationForSet === 1 || iterationForSet === 3 ? 0.1 : 0.8;
        const scaleDepth = iterationForSet === 1 || iterationForSet === 3 ? 0.1 : 0.5;
        const repeat = iterationForSet === 1 ? randomSetting1 : 1;
        const kaleid =
          iterationForSet === 1
            ? 50
            : iterationForSet === 2
              ? 1 + amplitude * randomSetting2
              : iterationForSet === 3
                ? 1 + amplitude * randomSetting2 * 10
                : 1 + amplitude * randomSetting2 * 50;
        const scale = iterationForSet === 1 ? 0.5 : 0.01 * bigRandom;
        const voronoiScale =
          iterationForSet === 1 || iterationForSet === 2 ? randomShape * 0.2 : randomShape * 0.7;
        const voronoiOffset =
          iterationForSet === 4 ? 0.7 * amplitude : iterationForSet === 3 ? 0.7 : 0.5;

        const row = voronoi(3, voronoiScale, voronoiOffset)
          .color(colors[0], colors[1], colors[2])
          .modulateRotate(
            shape(randomShape, iterationForSet >= 3 ? 0.3 : 0.1, iterationForSet >= 3 ? 0.7 : 0.1),
          )
          .mult(osc(20, 0.1, 0.5).rotate(1.58))
          .diff(o0)
          .modulateScale(noise(1, 0), -0.03)
          .scale(0.8, ({ time }) => scaleAmount + scaleDepth * Math.sin(scaleWave * time))
          .repeat(repeat, repeat, 0, 0)
          .modulateRotate(
            shape(randomShape, 0.3, 0.5).repeat(randomRotate, randomRotate, 0, 0),
            iterationForSet === 1 || iterationForSet === 2 ? 30 : randomSetting2,
          )
          .blend(
            noise(randomSetting3).color(
              ({ time }) => Math.sin(time) + bigRandom / 10,
              ({ time }) => Math.sin(time) + bigRandom / 100,
              ({ time }) => Math.sin(time) + bigRandom / 100,
            ),
          )
          .color(colors[0], colors[1], colors[2])
          .rotate(randomSetting2)
          .modulateScale(
            osc(iterationForSet === 1 ? amplitude * 10 : 4, -0.5, 0)
              .kaleid(kaleid)
              .scale(scale),
            15,
            0,
          )
          .repeat(
            iterationForSet === 4 ? randomRotate + amplitude : randomRotate,
            iterationForSet === 4 ? randomRotate + amplitude : randomRotate,
            0.0,
            0.0,
          )
          .modulate(src(s0), 1);

        (invert - 1 ? row.invert() : row).out(o0);
        src(o0).modulate(o1).out(o2);
        render(o0);
      }
    }

    const setState = (nextState) => {
      if (playing) stopPlayback(false);
      state = nextState;
      playable = Boolean(nextState.isPlayable);
      renderable = Boolean(nextState.hasVisualMaterial);
      params = getToneRowParams(nextState.address);
      sounds = nextState.composition.notes.map((note) => ({ ...note }));
      disposeSamplers();
      refreshUi();
      if (!playable) {
        setLoading(false);
        if (typeof onRendered === "function") onRendered();
        return;
      }
      setLoading(true);
      void initializeAndLoadSamplers()
        .then(() => {
          if (typeof onRendered === "function") onRendered();
        })
        .catch((error) => {
          postError(error instanceof Error ? error.message : "Could not load Tone World samples.");
        });
    };

    root.addEventListener("click", handleClick);
    window.addEventListener("resize", resizeCanvas, true);
    resizeCanvas();
    initHydra();
    setState(initialState);

    return {
      setState,
      dispose() {
        root.removeEventListener("click", handleClick);
        window.removeEventListener("resize", resizeCanvas, true);
        window.clearInterval(visualInterval);
        window.clearInterval(updateInterval);
        typewriter.dispose();
        stopPlayback(false);
        disposeSamplers();
      },
    };
  };
})();
